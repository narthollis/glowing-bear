(function() {
"use strict";

var weechat = angular.module('weechat');
var smiley = angular.module('smiley', []);

function fastSplice(str, index, count, add) {
    return str.slice(0, index) + add + str.slice(index + count);
}

smiley.service('$smiley', ['smileyThemes', '$http', function(smileyThemes, $http) {

    var AhoCorasick = function() {
        this._root = {};
    };

    /**
     * @param {string} word
     */
    AhoCorasick.prototype.add = function add(word) {
        var i, char, node = this._root, uword;
        if( !(typeof word === 'string' || word instanceof String) ) {
            throw new TypeError("word is not string");
        }
        uword = word.toUpperCase();
        // // Assert start position with a space character
        // node = node[" "] || (node[" "] = {_parent: node});
        for( i = 0 ; i < uword.length; i++ ) {
            char = uword.charAt(i);
            node = node[char] || (node[char] = {_parent: node});
        }
        node._result = word;
    };
    AhoCorasick.prototype.compile = function compile() {
        var queue = [], entry, node, child, fall;
        // JavaScript scoping fails, so we should declare in obvious places
        var i, keys, key;

        queue.push(this._root);
        while( queue.length > 0 ) {
            node = queue.shift();
            delete node._fall;
            keys = Object.keys(node);
            for( i = 0 ; i < keys.length; i++ ) {
                key = keys[i];
                if(key.length > 1) {
                    continue;
                }
                queue.push(node[key]);
            }
        }

        this._root._fall = this._root;
        queue.push({char: null, node: this._root});
        while( queue.length > 0 ) {
            entry = queue.shift();
            node = entry.node;
            keys = Object.keys(node);
            for( i = 0 ; i < keys.length; i++ ) {
                key = keys[i];
                if(key.length > 1) {
                    continue;
                }
                var char = key;
                child = node[key];
                queue.push({char: char, node: child});
            }
            if( node === this._root ) {
                continue;
            }
            fall = node._parent._fall;
            while( fall[entry.char] === undefined && fall !== this._root ) {
                fall = fall._fall;
            }
            node._fall = fall[entry.char] || this._root;
            if( node._fall === node ) {
                node._fall = this._root;
            }
        }
    };

    AhoCorasick.prototype.search = function search(text) {
        var result = [], state = this._root, node, i, self=this;
        if( !(typeof text === 'string' || text instanceof String) ) {
            throw new TypeError("word is not string");
        }
        text = text.toUpperCase();
        var step = function search_step(char, index) {
            node = state;
            while( node[char] === undefined && node !== self._root ) {
                node = node._fall;
            }
            if( node === self._root ) {
                node = node[char] || self._root;
            }
            else {
                node = node[char];
            }
            state = node;
            while( node !== self._root ) {
                if( node._result ) {
                    result.push([node._result, index]);
                }
                node = node._fall;
            }
        };
        // step(" ");
        for( i = 0 ; i < text.length ; i++ ) {
            step(text.charAt(i), i);
        }
        return result;
    };

    var _matchWhitespace = /\s+/;

    /**
     * Defines the Theme object
     */
    var Theme = function(path) {
        this.path = path;
        this.AC = new AhoCorasick();
        this.stringToImage = {};

        this.name = "";
        this.description = "";
        this.icon = "";
        this.author = "";

        var self = this;

        $http.get(this.path + 'theme').success(function(data) {
            var started = false, line, i, j, image;
            var lines = data.split(/\r\n|\r|\n/);
            for(i=0;i<lines.length;i++) {
                line = lines[i].trim();
                
                if (line[0] === '#') {
                    continue;
                }
                
                if (!started) {
                    if (line[0] === '[') {
                        started = true;
                    } else {
                        line = line.split('=',1);
                        line[0] = line[0].toUpperCase();
                        if (line[0] === 'NAME') {
                            self.name = line[1];
                        } else if (line[0] === 'DESCRIPTION') {
                            self.description = line[1];
                        } else if (line[0] === 'ICON') {
                            self.icon = line[1];
                        } else if (line[0] === 'AUTHOR') {
                            self.author = line[1];
                        }
                    }
                } else {
                    if (line[0] === '[') {
                        continue;
                    }
                    
                    if (line[0] === '!') {
                        line = line.substring(1,line.length).trim();
                    }
                    line = line.split(_matchWhitespace);
                    image = line.shift();
                    for (j=0; j<line.length; j++) {
                        self.AC.add(line[j]);
                        self.stringToImage[line[j]] = image;
                    }
                }
            }
            self.AC.compile();
        });
    };

    Theme.prototype.substitute = function(message) {
        var i, img, index;
        var matches = this.AC.search(message);
        for(i=matches.length-1; i>=0; i--) {
            img = '<img style="background:white" ' +
                ' alt="' + matches[i][0] + '"' +
                ' title="' + matches[i][0] + '"' +
                ' src="' + this.path + this.stringToImage[matches[i][0]] + '" />';
            
            index = matches[i][1] - (matches[i][0].length - 1);
            message = fastSplice(message, index,  matches[i][0].length, img);
        }
        
        return message;
    };

    /**
     * Defines the Theme Manager Object
     */
    var ThemeManagerObject = function() {
        this.themes = [];
    };

    ThemeManagerObject.prototype.registerThemes = function(smileyThemes) {
        var i;
        for (i=0; i<smileyThemes.length; i++) {
            this.themes.push(new Theme(smileyThemes[i]));
        }
    };

    ThemeManagerObject.prototype.substitute = function(message) {
        var i;
        for(i=0; i<this.themes.length; i++) {
            message = this.themes[i].substitute(message);
        }

        return message;
    };

    this.SmileyThemeManager = new ThemeManagerObject();
    this.SmileyThemeManager.registerThemes(smileyThemes.themes);
    
}]);

smiley.factory('smileyThemes', function() {
    return {themes: ["assets/smiley/sagf_spring_2015/"]};
});

weechat.filter('smiley', ['$smiley', function($smiley) {
    return function(message) {
        return $smiley.SmileyThemeManager.substitute(message);
    };
}]);

})();
