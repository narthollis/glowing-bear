(function() {
"use strict";

var weechat = angular.module('weechat');

function fastSplice(str, index, count, add) {
    return str.slice(0, index) + add + str.slice(index + count);
}

/**
 * @constructor
 */
var AhoCorasick = function() {
    this._root = {};
};

AhoCorasick.prototype = {
    /**
     * @param {string} word
     */
    add: function add(word) {
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
    },
    compile: function compile() {
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
                if(key.length <= 1) {
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
    },
    search: function search(text) {
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
    }
};


weechat.filter('smily', ['$http', function($http) {
    var path = "assets/smiley/sagf_spring_2015/";
    var AC = new AhoCorasick();
    var stringToImage = {};
    var splitOnWhiteSpace = /\s+/;

    $http.get(path + 'theme').success(function(data) {
        var started = false, line, i, j, image;
        var lines = data.split(/\r\n|\r|\n/);
        for(i=0;i<lines.length;i++) {
            line = lines[i].trim();

            if (line[0] != '#') {
                if (!started) {
                    if (line[0] == '[') {
                        started = true;
                    }
                } else {
                    if (line[0] != '[') {
                        if (line[0] == '!') {
                            line = line.substring(1,line.length).trim();
                        }

                        line = line.split(splitOnWhiteSpace);
                        image = line.shift();
                        for (j=0; j<line.length; j++) {
                            AC.add(line[j]);
                            stringToImage[line[j]] = image;
                        }
                    } 
                }
            }
        }

        AC.compile();
    });

    return function(text) {
        var i, img, index;
        var matches = AC.search(text);
        for(i=matches.length-1; i>=0; i--) {
            img = '<img style="background:white" ' +
                  ' alt="' + matches[i][0] + '"' +
                  ' title="' + matches[i][0] + '"' +
                  ' src="' + path + stringToImage[matches[i][0]] + '" />';

            index = matches[i][1] - (matches[i][0].length - 1);
            text = fastSplice(text, index,  matches[i][0].length, img);
        }

        return text;
    };
}]);

})();
