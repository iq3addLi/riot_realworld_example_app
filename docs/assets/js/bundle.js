(function () {
  'use strict';

  (function() {

    if (self.fetch) {
      return
    }

    function normalizeName(name) {
      if (typeof name !== 'string') {
        name = name.toString();
      }
      if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
        throw new TypeError('Invalid character in header field name')
      }
      return name.toLowerCase()
    }

    function normalizeValue(value) {
      if (typeof value !== 'string') {
        value = value.toString();
      }
      return value
    }

    function Headers(headers) {
      this.map = {};

      var self = this;
      if (headers instanceof Headers) {
        headers.forEach(function(name, values) {
          values.forEach(function(value) {
            self.append(name, value);
          });
        });

      } else if (headers) {
        Object.getOwnPropertyNames(headers).forEach(function(name) {
          self.append(name, headers[name]);
        });
      }
    }

    Headers.prototype.append = function(name, value) {
      name = normalizeName(name);
      value = normalizeValue(value);
      var list = this.map[name];
      if (!list) {
        list = [];
        this.map[name] = list;
      }
      list.push(value);
    };

    Headers.prototype['delete'] = function(name) {
      delete this.map[normalizeName(name)];
    };

    Headers.prototype.get = function(name) {
      var values = this.map[normalizeName(name)];
      return values ? values[0] : null
    };

    Headers.prototype.getAll = function(name) {
      return this.map[normalizeName(name)] || []
    };

    Headers.prototype.has = function(name) {
      return this.map.hasOwnProperty(normalizeName(name))
    };

    Headers.prototype.set = function(name, value) {
      this.map[normalizeName(name)] = [normalizeValue(value)];
    };

    // Instead of iterable for now.
    Headers.prototype.forEach = function(callback) {
      var self = this;
      Object.getOwnPropertyNames(this.map).forEach(function(name) {
        callback(name, self.map[name]);
      });
    };

    function consumed(body) {
      if (body.bodyUsed) {
        return fetch.Promise.reject(new TypeError('Already read'))
      }
      body.bodyUsed = true;
    }

    function fileReaderReady(reader) {
      return new fetch.Promise(function(resolve, reject) {
        reader.onload = function() {
          resolve(reader.result);
        };
        reader.onerror = function() {
          reject(reader.error);
        };
      })
    }

    function readBlobAsArrayBuffer(blob) {
      var reader = new FileReader();
      reader.readAsArrayBuffer(blob);
      return fileReaderReady(reader)
    }

    function readBlobAsText(blob) {
      var reader = new FileReader();
      reader.readAsText(blob);
      return fileReaderReady(reader)
    }

    var support = {
      blob: 'FileReader' in self && 'Blob' in self && (function() {
        try {
          new Blob();
          return true
        } catch(e) {
          return false
        }
      })(),
      formData: 'FormData' in self
    };

    function Body() {
      this.bodyUsed = false;


      this._initBody = function(body) {
        this._bodyInit = body;
        if (typeof body === 'string') {
          this._bodyText = body;
        } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
          this._bodyBlob = body;
        } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
          this._bodyFormData = body;
        } else if (!body) {
          this._bodyText = '';
        } else {
          throw new Error('unsupported BodyInit type')
        }
      };

      if (support.blob) {
        this.blob = function() {
          var rejected = consumed(this);
          if (rejected) {
            return rejected
          }

          if (this._bodyBlob) {
            return fetch.Promise.resolve(this._bodyBlob)
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as blob')
          } else {
            return fetch.Promise.resolve(new Blob([this._bodyText]))
          }
        };

        this.arrayBuffer = function() {
          return this.blob().then(readBlobAsArrayBuffer)
        };

        this.text = function() {
          var rejected = consumed(this);
          if (rejected) {
            return rejected
          }

          if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob)
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as text')
          } else {
            return fetch.Promise.resolve(this._bodyText)
          }
        };
      } else {
        this.text = function() {
          var rejected = consumed(this);
          return rejected ? rejected : fetch.Promise.resolve(this._bodyText)
        };
      }

      if (support.formData) {
        this.formData = function() {
          return this.text().then(decode)
        };
      }

      this.json = function() {
        return this.text().then(function (text) {
            return JSON.parse(text);
        });
      };

      return this
    }

    // HTTP methods whose capitalization should be normalized
    var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

    function normalizeMethod(method) {
      var upcased = method.toUpperCase();
      return (methods.indexOf(upcased) > -1) ? upcased : method
    }

    function Request(url, options) {
      options = options || {};
      this.url = url;

      this.credentials = options.credentials || 'omit';
      this.headers = new Headers(options.headers);
      this.method = normalizeMethod(options.method || 'GET');
      this.mode = options.mode || null;
      this.referrer = null;

      if ((this.method === 'GET' || this.method === 'HEAD') && options.body) {
        throw new TypeError('Body not allowed for GET or HEAD requests')
      }
      this._initBody(options.body);
    }

    function decode(body) {
      var form = new FormData();
      body.trim().split('&').forEach(function(bytes) {
        if (bytes) {
          var split = bytes.split('=');
          var name = split.shift().replace(/\+/g, ' ');
          var value = split.join('=').replace(/\+/g, ' ');
          form.append(decodeURIComponent(name), decodeURIComponent(value));
        }
      });
      return form
    }

    function headers(xhr) {
      var head = new Headers();
      var pairs = xhr.getAllResponseHeaders().trim().split('\n');
      pairs.forEach(function(header) {
        var split = header.trim().split(':');
        var key = split.shift().trim();
        var value = split.join(':').trim();
        head.append(key, value);
      });
      return head
    }

    var noXhrPatch =
      typeof window !== 'undefined' && !!window.ActiveXObject &&
        !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

    function getXhr() {
      // from backbone.js 1.1.2
      // https://github.com/jashkenas/backbone/blob/1.1.2/backbone.js#L1181
      if (noXhrPatch && !(/^(get|post|head|put|delete|options)$/i.test(this.method))) {
        this.usingActiveXhr = true;
        return new ActiveXObject("Microsoft.XMLHTTP");
      }
      return new XMLHttpRequest();
    }

    Body.call(Request.prototype);

    function Response(bodyInit, options) {
      if (!options) {
        options = {};
      }

      this._initBody(bodyInit);
      this.type = 'default';
      this.url = null;
      this.status = options.status;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = options.statusText;
      this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      this.url = options.url || '';
    }

    Body.call(Response.prototype);

    self.Headers = Headers;
    self.Request = Request;
    self.Response = Response;

    self.fetch = function(input, init) {
      // TODO: Request constructor should accept input, init
      var request;
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input;
      } else {
        request = new Request(input, init);
      }

      return new fetch.Promise(function(resolve, reject) {
        var xhr = getXhr();
        if (request.credentials === 'cors') {
          xhr.withCredentials = true;
        }

        function responseURL() {
          if ('responseURL' in xhr) {
            return xhr.responseURL
          }

          // Avoid security warnings on getResponseHeader when not allowed by CORS
          if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
            return xhr.getResponseHeader('X-Request-URL')
          }

          return;
        }

        function onload() {
          if (xhr.readyState !== 4) {
            return
          }
          var status = (xhr.status === 1223) ? 204 : xhr.status;
          if (status < 100 || status > 599) {
            reject(new TypeError('Network request failed'));
            return
          }
          var options = {
            status: status,
            statusText: xhr.statusText,
            headers: headers(xhr),
            url: responseURL()
          };
          var body = 'response' in xhr ? xhr.response : xhr.responseText;
          resolve(new Response(body, options));
        }
        xhr.onreadystatechange = onload;
        if (!self.usingActiveXhr) {
          xhr.onload = onload;
          xhr.onerror = function() {
            reject(new TypeError('Network request failed'));
          };
        }

        xhr.open(request.method, request.url, true);

        if ('responseType' in xhr && support.blob) {
          xhr.responseType = 'blob';
        }

        request.headers.forEach(function(name, values) {
          values.forEach(function(value) {
            xhr.setRequestHeader(name, value);
          });
        });

        xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
      })
    };
    fetch.Promise = self.Promise; // you could change it to your favorite alternative
    self.fetch.polyfill = true;
  })();

  /**
   * Shorter and fast way to select a single node in the DOM
   * @param   { String } selector - unique dom selector
   * @param   { Object } ctx - DOM node where the target of our search will is located
   * @returns { Object } dom node found
   */
  function $(selector, ctx) {
    return (ctx || document).querySelector(selector)
  }

  const
    // be aware, internal usage
    // ATTENTION: prefix the global dynamic variables with `__`
    // tags instances cache
    __TAGS_CACHE = [],
    // tags implementation cache
    __TAG_IMPL = {},
    YIELD_TAG = 'yield',

    /**
     * Const
     */
    GLOBAL_MIXIN = '__global_mixin',

    // riot specific prefixes or attributes
    ATTRS_PREFIX = 'riot-',

    // Riot Directives
    REF_DIRECTIVES = ['ref', 'data-ref'],
    IS_DIRECTIVE = 'data-is',
    CONDITIONAL_DIRECTIVE = 'if',
    LOOP_DIRECTIVE = 'each',
    LOOP_NO_REORDER_DIRECTIVE = 'no-reorder',
    SHOW_DIRECTIVE = 'show',
    HIDE_DIRECTIVE = 'hide',
    KEY_DIRECTIVE = 'key',
    RIOT_EVENTS_KEY = '__riot-events__',

    // for typeof == '' comparisons
    T_STRING = 'string',
    T_OBJECT = 'object',
    T_UNDEF  = 'undefined',
    T_FUNCTION = 'function',

    XLINK_NS = 'http://www.w3.org/1999/xlink',
    SVG_NS = 'http://www.w3.org/2000/svg',
    XLINK_REGEX = /^xlink:(\w+)/,

    WIN = typeof window === T_UNDEF ? /* istanbul ignore next */ undefined : window,

    // special native tags that cannot be treated like the others
    RE_SPECIAL_TAGS = /^(?:t(?:body|head|foot|[rhd])|caption|col(?:group)?|opt(?:ion|group))$/,
    RE_SPECIAL_TAGS_NO_OPTION = /^(?:t(?:body|head|foot|[rhd])|caption|col(?:group)?)$/,
    RE_EVENTS_PREFIX = /^on/,
    RE_HTML_ATTRS = /([-\w]+) ?= ?(?:"([^"]*)|'([^']*)|({[^}]*}))/g,
    // some DOM attributes must be normalized
    CASE_SENSITIVE_ATTRIBUTES = {
      'viewbox': 'viewBox',
      'preserveaspectratio': 'preserveAspectRatio'
    },
    /**
     * Matches boolean HTML attributes in the riot tag definition.
     * With a long list like this, a regex is faster than `[].indexOf` in most browsers.
     * @const {RegExp}
     * @see [attributes.md](https://github.com/riot/compiler/blob/dev/doc/attributes.md)
     */
    RE_BOOL_ATTRS = /^(?:disabled|checked|readonly|required|allowfullscreen|auto(?:focus|play)|compact|controls|default|formnovalidate|hidden|ismap|itemscope|loop|multiple|muted|no(?:resize|shade|validate|wrap)?|open|reversed|seamless|selected|sortable|truespeed|typemustmatch)$/,
    // version# for IE 8-11, 0 for others
    IE_VERSION = (WIN && WIN.document || /* istanbul ignore next */ {}).documentMode | 0;

  /**
   * Create a generic DOM node
   * @param   { String } name - name of the DOM node we want to create
   * @returns { Object } DOM node just created
   */
  function makeElement(name) {
    return name === 'svg' ? document.createElementNS(SVG_NS, name) : document.createElement(name)
  }

  /**
   * Set any DOM attribute
   * @param { Object } dom - DOM node we want to update
   * @param { String } name - name of the property we want to set
   * @param { String } val - value of the property we want to set
   */
  function setAttribute(dom, name, val) {
    const xlink = XLINK_REGEX.exec(name);
    if (xlink && xlink[1])
      dom.setAttributeNS(XLINK_NS, xlink[1], val);
    else
      dom.setAttribute(name, val);
  }

  let styleNode;
  // Create cache and shortcut to the correct property
  let cssTextProp;
  let byName = {};
  let needsInject = false;

  // skip the following code on the server
  if (WIN) {
    styleNode = ((() => {
      // create a new style element with the correct type
      const newNode = makeElement('style');
      // replace any user node or insert the new one into the head
      const userNode = $('style[type=riot]');

      setAttribute(newNode, 'type', 'text/css');
      /* istanbul ignore next */
      if (userNode) {
        if (userNode.id) newNode.id = userNode.id;
        userNode.parentNode.replaceChild(newNode, userNode);
      } else document.head.appendChild(newNode);

      return newNode
    }))();
    cssTextProp = styleNode.styleSheet;
  }

  /**
   * Object that will be used to inject and manage the css of every tag instance
   */
  var styleManager = {
    styleNode,
    /**
     * Save a tag style to be later injected into DOM
     * @param { String } css - css string
     * @param { String } name - if it's passed we will map the css to a tagname
     */
    add(css, name) {
      byName[name] = css;
      needsInject = true;
    },
    /**
     * Inject all previously saved tag styles into DOM
     * innerHTML seems slow: http://jsperf.com/riot-insert-style
     */
    inject() {
      if (!WIN || !needsInject) return
      needsInject = false;
      const style = Object.keys(byName)
        .map(k => byName[k])
        .join('\n');
      /* istanbul ignore next */
      if (cssTextProp) cssTextProp.cssText = style;
      else styleNode.innerHTML = style;
    },

    /**
     * Remove a tag style of injected DOM later.
     * @param {String} name a registered tagname
     */
    remove(name) {
      delete byName[name];
      needsInject = true;
    }
  };

  /**
   * The riot template engine
   * @version v3.0.8
   */

  var skipRegex = (function () { //eslint-disable-line no-unused-vars

    var beforeReChars = '[{(,;:?=|&!^~>%*/';

    var beforeReWords = [
      'case',
      'default',
      'do',
      'else',
      'in',
      'instanceof',
      'prefix',
      'return',
      'typeof',
      'void',
      'yield'
    ];

    var wordsLastChar = beforeReWords.reduce(function (s, w) {
      return s + w.slice(-1)
    }, '');

    var RE_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/;
    var RE_VN_CHAR = /[$\w]/;

    function prev (code, pos) {
      while (--pos >= 0 && /\s/.test(code[pos]));
      return pos
    }

    function _skipRegex (code, start) {

      var re = /.*/g;
      var pos = re.lastIndex = start++;
      var match = re.exec(code)[0].match(RE_REGEX);

      if (match) {
        var next = pos + match[0].length;

        pos = prev(code, pos);
        var c = code[pos];

        if (pos < 0 || ~beforeReChars.indexOf(c)) {
          return next
        }

        if (c === '.') {

          if (code[pos - 1] === '.') {
            start = next;
          }

        } else if (c === '+' || c === '-') {

          if (code[--pos] !== c ||
              (pos = prev(code, pos)) < 0 ||
              !RE_VN_CHAR.test(code[pos])) {
            start = next;
          }

        } else if (~wordsLastChar.indexOf(c)) {

          var end = pos + 1;

          while (--pos >= 0 && RE_VN_CHAR.test(code[pos]));
          if (~beforeReWords.indexOf(code.slice(pos + 1, end))) {
            start = next;
          }
        }
      }

      return start
    }

    return _skipRegex

  })();

  /**
   * riot.util.brackets
   *
   * - `brackets    ` - Returns a string or regex based on its parameter
   * - `brackets.set` - Change the current riot brackets
   *
   * @module
   */

  /* global riot */

  var brackets = (function (UNDEF) {

    var
      REGLOB = 'g',

      R_MLCOMMS = /\/\*[^*]*\*+(?:[^*\/][^*]*\*+)*\//g,

      R_STRINGS = /"[^"\\]*(?:\\[\S\s][^"\\]*)*"|'[^'\\]*(?:\\[\S\s][^'\\]*)*'|`[^`\\]*(?:\\[\S\s][^`\\]*)*`/g,

      S_QBLOCKS = R_STRINGS.source + '|' +
        /(?:\breturn\s+|(?:[$\w\)\]]|\+\+|--)\s*(\/)(?![*\/]))/.source + '|' +
        /\/(?=[^*\/])[^[\/\\]*(?:(?:\[(?:\\.|[^\]\\]*)*\]|\\.)[^[\/\\]*)*?([^<]\/)[gim]*/.source,

      UNSUPPORTED = RegExp('[\\' + 'x00-\\x1F<>a-zA-Z0-9\'",;\\\\]'),

      NEED_ESCAPE = /(?=[[\]()*+?.^$|])/g,

      S_QBLOCK2 = R_STRINGS.source + '|' + /(\/)(?![*\/])/.source,

      FINDBRACES = {
        '(': RegExp('([()])|'   + S_QBLOCK2, REGLOB),
        '[': RegExp('([[\\]])|' + S_QBLOCK2, REGLOB),
        '{': RegExp('([{}])|'   + S_QBLOCK2, REGLOB)
      },

      DEFAULT = '{ }';

    var _pairs = [
      '{', '}',
      '{', '}',
      /{[^}]*}/,
      /\\([{}])/g,
      /\\({)|{/g,
      RegExp('\\\\(})|([[({])|(})|' + S_QBLOCK2, REGLOB),
      DEFAULT,
      /^\s*{\^?\s*([$\w]+)(?:\s*,\s*(\S+))?\s+in\s+(\S.*)\s*}/,
      /(^|[^\\]){=[\S\s]*?}/
    ];

    var
      cachedBrackets = UNDEF,
      _regex,
      _cache = [],
      _settings;

    function _loopback (re) { return re }

    function _rewrite (re, bp) {
      if (!bp) bp = _cache;
      return new RegExp(
        re.source.replace(/{/g, bp[2]).replace(/}/g, bp[3]), re.global ? REGLOB : ''
      )
    }

    function _create (pair) {
      if (pair === DEFAULT) return _pairs

      var arr = pair.split(' ');

      if (arr.length !== 2 || UNSUPPORTED.test(pair)) {
        throw new Error('Unsupported brackets "' + pair + '"')
      }
      arr = arr.concat(pair.replace(NEED_ESCAPE, '\\').split(' '));

      arr[4] = _rewrite(arr[1].length > 1 ? /{[\S\s]*?}/ : _pairs[4], arr);
      arr[5] = _rewrite(pair.length > 3 ? /\\({|})/g : _pairs[5], arr);
      arr[6] = _rewrite(_pairs[6], arr);
      arr[7] = RegExp('\\\\(' + arr[3] + ')|([[({])|(' + arr[3] + ')|' + S_QBLOCK2, REGLOB);
      arr[8] = pair;
      return arr
    }

    function _brackets (reOrIdx) {
      return reOrIdx instanceof RegExp ? _regex(reOrIdx) : _cache[reOrIdx]
    }

    _brackets.split = function split (str, tmpl, _bp) {
      // istanbul ignore next: _bp is for the compiler
      if (!_bp) _bp = _cache;

      var
        parts = [],
        match,
        isexpr,
        start,
        pos,
        re = _bp[6];

      var qblocks = [];
      var prevStr = '';
      var mark, lastIndex;

      isexpr = start = re.lastIndex = 0;

      while ((match = re.exec(str))) {

        lastIndex = re.lastIndex;
        pos = match.index;

        if (isexpr) {

          if (match[2]) {

            var ch = match[2];
            var rech = FINDBRACES[ch];
            var ix = 1;

            rech.lastIndex = lastIndex;
            while ((match = rech.exec(str))) {
              if (match[1]) {
                if (match[1] === ch) ++ix;
                else if (!--ix) break
              } else {
                rech.lastIndex = pushQBlock(match.index, rech.lastIndex, match[2]);
              }
            }
            re.lastIndex = ix ? str.length : rech.lastIndex;
            continue
          }

          if (!match[3]) {
            re.lastIndex = pushQBlock(pos, lastIndex, match[4]);
            continue
          }
        }

        if (!match[1]) {
          unescapeStr(str.slice(start, pos));
          start = re.lastIndex;
          re = _bp[6 + (isexpr ^= 1)];
          re.lastIndex = start;
        }
      }

      if (str && start < str.length) {
        unescapeStr(str.slice(start));
      }

      parts.qblocks = qblocks;

      return parts

      function unescapeStr (s) {
        if (prevStr) {
          s = prevStr + s;
          prevStr = '';
        }
        if (tmpl || isexpr) {
          parts.push(s && s.replace(_bp[5], '$1'));
        } else {
          parts.push(s);
        }
      }

      function pushQBlock(_pos, _lastIndex, slash) { //eslint-disable-line
        if (slash) {
          _lastIndex = skipRegex(str, _pos);
        }

        if (tmpl && _lastIndex > _pos + 2) {
          mark = '\u2057' + qblocks.length + '~';
          qblocks.push(str.slice(_pos, _lastIndex));
          prevStr += str.slice(start, _pos) + mark;
          start = _lastIndex;
        }
        return _lastIndex
      }
    };

    _brackets.hasExpr = function hasExpr (str) {
      return _cache[4].test(str)
    };

    _brackets.loopKeys = function loopKeys (expr) {
      var m = expr.match(_cache[9]);

      return m
        ? { key: m[1], pos: m[2], val: _cache[0] + m[3].trim() + _cache[1] }
        : { val: expr.trim() }
    };

    _brackets.array = function array (pair) {
      return pair ? _create(pair) : _cache
    };

    function _reset (pair) {
      if ((pair || (pair = DEFAULT)) !== _cache[8]) {
        _cache = _create(pair);
        _regex = pair === DEFAULT ? _loopback : _rewrite;
        _cache[9] = _regex(_pairs[9]);
      }
      cachedBrackets = pair;
    }

    function _setSettings (o) {
      var b;

      o = o || {};
      b = o.brackets;
      Object.defineProperty(o, 'brackets', {
        set: _reset,
        get: function () { return cachedBrackets },
        enumerable: true
      });
      _settings = o;
      _reset(b);
    }

    Object.defineProperty(_brackets, 'settings', {
      set: _setSettings,
      get: function () { return _settings }
    });

    /* istanbul ignore next: in the browser riot is always in the scope */
    _brackets.settings = typeof riot !== 'undefined' && riot.settings || {};
    _brackets.set = _reset;
    _brackets.skipRegex = skipRegex;

    _brackets.R_STRINGS = R_STRINGS;
    _brackets.R_MLCOMMS = R_MLCOMMS;
    _brackets.S_QBLOCKS = S_QBLOCKS;
    _brackets.S_QBLOCK2 = S_QBLOCK2;

    return _brackets

  })();

  /**
   * @module tmpl
   *
   * tmpl          - Root function, returns the template value, render with data
   * tmpl.hasExpr  - Test the existence of a expression inside a string
   * tmpl.loopKeys - Get the keys for an 'each' loop (used by `_each`)
   */

  var tmpl = (function () {

    var _cache = {};

    function _tmpl (str, data) {
      if (!str) return str

      return (_cache[str] || (_cache[str] = _create(str))).call(
        data, _logErr.bind({
          data: data,
          tmpl: str
        })
      )
    }

    _tmpl.hasExpr = brackets.hasExpr;

    _tmpl.loopKeys = brackets.loopKeys;

    // istanbul ignore next
    _tmpl.clearCache = function () { _cache = {}; };

    _tmpl.errorHandler = null;

    function _logErr (err, ctx) {

      err.riotData = {
        tagName: ctx && ctx.__ && ctx.__.tagName,
        _riot_id: ctx && ctx._riot_id  //eslint-disable-line camelcase
      };

      if (_tmpl.errorHandler) _tmpl.errorHandler(err);
      else if (
        typeof console !== 'undefined' &&
        typeof console.error === 'function'
      ) {
        console.error(err.message);
        console.log('<%s> %s', err.riotData.tagName || 'Unknown tag', this.tmpl); // eslint-disable-line
        console.log(this.data); // eslint-disable-line
      }
    }

    function _create (str) {
      var expr = _getTmpl(str);

      if (expr.slice(0, 11) !== 'try{return ') expr = 'return ' + expr;

      return new Function('E', expr + ';')    // eslint-disable-line no-new-func
    }

    var RE_DQUOTE = /\u2057/g;
    var RE_QBMARK = /\u2057(\d+)~/g;

    function _getTmpl (str) {
      var parts = brackets.split(str.replace(RE_DQUOTE, '"'), 1);
      var qstr = parts.qblocks;
      var expr;

      if (parts.length > 2 || parts[0]) {
        var i, j, list = [];

        for (i = j = 0; i < parts.length; ++i) {

          expr = parts[i];

          if (expr && (expr = i & 1

              ? _parseExpr(expr, 1, qstr)

              : '"' + expr
                  .replace(/\\/g, '\\\\')
                  .replace(/\r\n?|\n/g, '\\n')
                  .replace(/"/g, '\\"') +
                '"'

            )) list[j++] = expr;

        }

        expr = j < 2 ? list[0]
             : '[' + list.join(',') + '].join("")';

      } else {

        expr = _parseExpr(parts[1], 0, qstr);
      }

      if (qstr.length) {
        expr = expr.replace(RE_QBMARK, function (_, pos) {
          return qstr[pos]
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
        });
      }
      return expr
    }

    var RE_CSNAME = /^(?:(-?[_A-Za-z\xA0-\xFF][-\w\xA0-\xFF]*)|\u2057(\d+)~):/;
    var
      RE_BREND = {
        '(': /[()]/g,
        '[': /[[\]]/g,
        '{': /[{}]/g
      };

    function _parseExpr (expr, asText, qstr) {

      expr = expr
        .replace(/\s+/g, ' ').trim()
        .replace(/\ ?([[\({},?\.:])\ ?/g, '$1');

      if (expr) {
        var
          list = [],
          cnt = 0,
          match;

        while (expr &&
              (match = expr.match(RE_CSNAME)) &&
              !match.index
          ) {
          var
            key,
            jsb,
            re = /,|([[{(])|$/g;

          expr = RegExp.rightContext;
          key  = match[2] ? qstr[match[2]].slice(1, -1).trim().replace(/\s+/g, ' ') : match[1];

          while (jsb = (match = re.exec(expr))[1]) skipBraces(jsb, re);

          jsb  = expr.slice(0, match.index);
          expr = RegExp.rightContext;

          list[cnt++] = _wrapExpr(jsb, 1, key);
        }

        expr = !cnt ? _wrapExpr(expr, asText)
             : cnt > 1 ? '[' + list.join(',') + '].join(" ").trim()' : list[0];
      }
      return expr

      function skipBraces (ch, re) {
        var
          mm,
          lv = 1,
          ir = RE_BREND[ch];

        ir.lastIndex = re.lastIndex;
        while (mm = ir.exec(expr)) {
          if (mm[0] === ch) ++lv;
          else if (!--lv) break
        }
        re.lastIndex = lv ? expr.length : ir.lastIndex;
      }
    }

    // istanbul ignore next: not both
    var // eslint-disable-next-line max-len
      JS_CONTEXT = '"in this?this:' + (typeof window !== 'object' ? 'global' : 'window') + ').',
      JS_VARNAME = /[,{][\$\w]+(?=:)|(^ *|[^$\w\.{])(?!(?:typeof|true|false|null|undefined|in|instanceof|is(?:Finite|NaN)|void|NaN|new|Date|RegExp|Math)(?![$\w]))([$_A-Za-z][$\w]*)/g,
      JS_NOPROPS = /^(?=(\.[$\w]+))\1(?:[^.[(]|$)/;

    function _wrapExpr (expr, asText, key) {
      var tb;

      expr = expr.replace(JS_VARNAME, function (match, p, mvar, pos, s) {
        if (mvar) {
          pos = tb ? 0 : pos + match.length;

          if (mvar !== 'this' && mvar !== 'global' && mvar !== 'window') {
            match = p + '("' + mvar + JS_CONTEXT + mvar;
            if (pos) tb = (s = s[pos]) === '.' || s === '(' || s === '[';
          } else if (pos) {
            tb = !JS_NOPROPS.test(s.slice(pos));
          }
        }
        return match
      });

      if (tb) {
        expr = 'try{return ' + expr + '}catch(e){E(e,this)}';
      }

      if (key) {

        expr = (tb
            ? 'function(){' + expr + '}.call(this)' : '(' + expr + ')'
          ) + '?"' + key + '":""';

      } else if (asText) {

        expr = 'function(v){' + (tb
            ? expr.replace('return ', 'v=') : 'v=(' + expr + ')'
          ) + ';return v||v===0?v:""}.call(this)';
      }

      return expr
    }

    _tmpl.version = brackets.version = 'v3.0.8';

    return _tmpl

  })();

  var observable = function(el) {

    /**
     * Extend the original object or create a new empty one
     * @type { Object }
     */

    el = el || {};

    /**
     * Private variables
     */
    var callbacks = {},
      slice = Array.prototype.slice;

    /**
     * Public Api
     */

    // extend the el object adding the observable methods
    Object.defineProperties(el, {
      /**
       * Listen to the given `event` ands
       * execute the `callback` each time an event is triggered.
       * @param  { String } event - event id
       * @param  { Function } fn - callback function
       * @returns { Object } el
       */
      on: {
        value: function(event, fn) {
          if (typeof fn == 'function')
            (callbacks[event] = callbacks[event] || []).push(fn);
          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Removes the given `event` listeners
       * @param   { String } event - event id
       * @param   { Function } fn - callback function
       * @returns { Object } el
       */
      off: {
        value: function(event, fn) {
          if (event == '*' && !fn) callbacks = {};
          else {
            if (fn) {
              var arr = callbacks[event];
              for (var i = 0, cb; cb = arr && arr[i]; ++i) {
                if (cb == fn) arr.splice(i--, 1);
              }
            } else delete callbacks[event];
          }
          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Listen to the given `event` and
       * execute the `callback` at most once
       * @param   { String } event - event id
       * @param   { Function } fn - callback function
       * @returns { Object } el
       */
      one: {
        value: function(event, fn) {
          function on() {
            el.off(event, on);
            fn.apply(el, arguments);
          }
          return el.on(event, on)
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Execute all callback functions that listen to
       * the given `event`
       * @param   { String } event - event id
       * @returns { Object } el
       */
      trigger: {
        value: function(event) {

          // getting the arguments
          var arglen = arguments.length - 1,
            args = new Array(arglen),
            fns,
            fn,
            i;

          for (i = 0; i < arglen; i++) {
            args[i] = arguments[i + 1]; // skip first argument
          }

          fns = slice.call(callbacks[event] || [], 0);

          for (i = 0; fn = fns[i]; ++i) {
            fn.apply(el, args);
          }

          if (callbacks['*'] && event != '*')
            el.trigger.apply(el, ['*', event].concat(args));

          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      }
    });

    return el

  };

  /**
   * Short alias for Object.getOwnPropertyDescriptor
   */
  function getPropDescriptor (o, k) {
    return Object.getOwnPropertyDescriptor(o, k)
  }

  /**
   * Check if passed argument is undefined
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isUndefined(value) {
    return typeof value === T_UNDEF
  }

  /**
   * Check whether object's property could be overridden
   * @param   { Object }  obj - source object
   * @param   { String }  key - object property
   * @returns { Boolean } true if writable
   */
  function isWritable(obj, key) {
    const descriptor = getPropDescriptor(obj, key);
    return isUndefined(obj[key]) || descriptor && descriptor.writable
  }

  /**
   * Extend any object with other properties
   * @param   { Object } src - source object
   * @returns { Object } the resulting extended object
   *
   * var obj = { foo: 'baz' }
   * extend(obj, {bar: 'bar', foo: 'bar'})
   * console.log(obj) => {bar: 'bar', foo: 'bar'}
   *
   */
  function extend(src) {
    let obj;
    let i = 1;
    const args = arguments;
    const l = args.length;

    for (; i < l; i++) {
      if (obj = args[i]) {
        for (const key in obj) {
          // check if this property of the source object could be overridden
          if (isWritable(src, key))
            src[key] = obj[key];
        }
      }
    }
    return src
  }

  /**
   * Alias for Object.create
   */
  function create(src) {
    return Object.create(src)
  }

  var s = extend(create(brackets.settings), {
    skipAnonymousTags: true,
    // the "value" attributes will be preserved
    keepValueAttributes: false,
    // handle the auto updates on any DOM event
    autoUpdate: true
  });

  /**
   * Shorter and fast way to select multiple nodes in the DOM
   * @param   { String } selector - DOM selector
   * @param   { Object } ctx - DOM node where the targets of our search will is located
   * @returns { Object } dom nodes found
   */
  function $$(selector, ctx) {
    return [].slice.call((ctx || document).querySelectorAll(selector))
  }

  /**
   * Create a document text node
   * @returns { Object } create a text node to use as placeholder
   */
  function createDOMPlaceholder() {
    return document.createTextNode('')
  }

  /**
   * Toggle the visibility of any DOM node
   * @param   { Object }  dom - DOM node we want to hide
   * @param   { Boolean } show - do we want to show it?
   */

  function toggleVisibility(dom, show) {
    dom.style.display = show ? '' : 'none';
    dom.hidden = show ? false : true;
  }

  /**
   * Get the value of any DOM attribute on a node
   * @param   { Object } dom - DOM node we want to parse
   * @param   { String } name - name of the attribute we want to get
   * @returns { String | undefined } name of the node attribute whether it exists
   */
  function getAttribute(dom, name) {
    return dom.getAttribute(name)
  }

  /**
   * Remove any DOM attribute from a node
   * @param   { Object } dom - DOM node we want to update
   * @param   { String } name - name of the property we want to remove
   */
  function removeAttribute(dom, name) {
    dom.removeAttribute(name);
  }

  /**
   * Set the inner html of any DOM node SVGs included
   * @param { Object } container - DOM node where we'll inject new html
   * @param { String } html - html to inject
   * @param { Boolean } isSvg - svg tags should be treated a bit differently
   */
  /* istanbul ignore next */
  function setInnerHTML(container, html, isSvg) {
    // innerHTML is not supported on svg tags so we neet to treat them differently
    if (isSvg) {
      const node = container.ownerDocument.importNode(
        new DOMParser()
          .parseFromString(`<svg xmlns="${ SVG_NS }">${ html }</svg>`, 'application/xml')
          .documentElement,
        true
      );

      container.appendChild(node);
    } else {
      container.innerHTML = html;
    }
  }

  /**
   * Minimize risk: only zero or one _space_ between attr & value
   * @param   { String }   html - html string we want to parse
   * @param   { Function } fn - callback function to apply on any attribute found
   */
  function walkAttributes(html, fn) {
    if (!html) return
    let m;
    while (m = RE_HTML_ATTRS.exec(html))
      fn(m[1].toLowerCase(), m[2] || m[3] || m[4]);
  }

  /**
   * Create a document fragment
   * @returns { Object } document fragment
   */
  function createFragment() {
    return document.createDocumentFragment()
  }

  /**
   * Insert safely a tag to fix #1962 #1649
   * @param   { HTMLElement } root - children container
   * @param   { HTMLElement } curr - node to insert
   * @param   { HTMLElement } next - node that should preceed the current node inserted
   */
  function safeInsert(root, curr, next) {
    root.insertBefore(curr, next.parentNode && next);
  }

  /**
   * Convert a style object to a string
   * @param   { Object } style - style object we need to parse
   * @returns { String } resulting css string
   * @example
   * styleObjectToString({ color: 'red', height: '10px'}) // => 'color: red; height: 10px'
   */
  function styleObjectToString(style) {
    return Object.keys(style).reduce((acc, prop) => {
      return `${acc} ${prop}: ${style[prop]};`
    }, '')
  }

  /**
   * Walk down recursively all the children tags starting dom node
   * @param   { Object }   dom - starting node where we will start the recursion
   * @param   { Function } fn - callback to transform the child node just found
   * @param   { Object }   context - fn can optionally return an object, which is passed to children
   */
  function walkNodes(dom, fn, context) {
    if (dom) {
      const res = fn(dom, context);
      let next;
      // stop the recursion
      if (res === false) return

      dom = dom.firstChild;

      while (dom) {
        next = dom.nextSibling;
        walkNodes(dom, fn, res);
        dom = next;
      }
    }
  }



  var dom = /*#__PURE__*/Object.freeze({
    $$: $$,
    $: $,
    createDOMPlaceholder: createDOMPlaceholder,
    mkEl: makeElement,
    setAttr: setAttribute,
    toggleVisibility: toggleVisibility,
    getAttr: getAttribute,
    remAttr: removeAttribute,
    setInnerHTML: setInnerHTML,
    walkAttrs: walkAttributes,
    createFrag: createFragment,
    safeInsert: safeInsert,
    styleObjectToString: styleObjectToString,
    walkNodes: walkNodes
  });

  /**
   * Check against the null and undefined values
   * @param   { * }  value -
   * @returns {Boolean} -
   */
  function isNil(value) {
    return isUndefined(value) || value === null
  }

  /**
   * Check if passed argument is empty. Different from falsy, because we dont consider 0 or false to be blank
   * @param { * } value -
   * @returns { Boolean } -
   */
  function isBlank(value) {
    return isNil(value) || value === ''
  }

  /**
   * Check if passed argument is a function
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isFunction(value) {
    return typeof value === T_FUNCTION
  }

  /**
   * Check if passed argument is an object, exclude null
   * NOTE: use isObject(x) && !isArray(x) to excludes arrays.
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isObject(value) {
    return value && typeof value === T_OBJECT // typeof null is 'object'
  }

  /**
   * Check if a DOM node is an svg tag or part of an svg
   * @param   { HTMLElement }  el - node we want to test
   * @returns {Boolean} true if it's an svg node
   */
  function isSvg(el) {
    const owner = el.ownerSVGElement;
    return !!owner || owner === null
  }

  /**
   * Check if passed argument is a kind of array
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isArray(value) {
    return Array.isArray(value) || value instanceof Array
  }

  /**
   * Check if the passed argument is a boolean attribute
   * @param   { String } value -
   * @returns { Boolean } -
   */
  function isBoolAttr(value) {
    return RE_BOOL_ATTRS.test(value)
  }

  /**
   * Check if passed argument is a string
   * @param   { * } value -
   * @returns { Boolean } -
   */
  function isString(value) {
    return typeof value === T_STRING
  }



  var check = /*#__PURE__*/Object.freeze({
    isBlank: isBlank,
    isFunction: isFunction,
    isObject: isObject,
    isSvg: isSvg,
    isWritable: isWritable,
    isArray: isArray,
    isBoolAttr: isBoolAttr,
    isNil: isNil,
    isString: isString,
    isUndefined: isUndefined
  });

  /**
   * Check whether an array contains an item
   * @param   { Array } array - target array
   * @param   { * } item - item to test
   * @returns { Boolean } -
   */
  function contains(array, item) {
    return array.indexOf(item) !== -1
  }

  /**
   * Specialized function for looping an array-like collection with `each={}`
   * @param   { Array } list - collection of items
   * @param   {Function} fn - callback function
   * @returns { Array } the array looped
   */
  function each(list, fn) {
    const len = list ? list.length : 0;
    let i = 0;
    for (; i < len; i++) fn(list[i], i);
    return list
  }

  /**
   * Faster String startsWith alternative
   * @param   { String } str - source string
   * @param   { String } value - test string
   * @returns { Boolean } -
   */
  function startsWith(str, value) {
    return str.slice(0, value.length) === value
  }

  /**
   * Function returning always a unique identifier
   * @returns { Number } - number from 0...n
   */
  var uid = (function uid() {
    let i = -1;
    return () => ++i
  })();

  /**
   * Helper function to set an immutable property
   * @param   { Object } el - object where the new property will be set
   * @param   { String } key - object key where the new property will be stored
   * @param   { * } value - value of the new property
   * @param   { Object } options - set the propery overriding the default options
   * @returns { Object } - the initial object
   */
  function define(el, key, value, options) {
    Object.defineProperty(el, key, extend({
      value,
      enumerable: false,
      writable: false,
      configurable: true
    }, options));
    return el
  }

  /**
   * Convert a string containing dashes to camel case
   * @param   { String } str - input string
   * @returns { String } my-string -> myString
   */
  function toCamel(str) {
    return str.replace(/-(\w)/g, (_, c) => c.toUpperCase())
  }

  /**
   * Warn a message via console
   * @param   {String} message - warning message
   */
  function warn(message) {
    if (console && console.warn) console.warn(message);
  }



  var misc = /*#__PURE__*/Object.freeze({
    contains: contains,
    each: each,
    getPropDescriptor: getPropDescriptor,
    startsWith: startsWith,
    uid: uid,
    defineProperty: define,
    objectCreate: create,
    extend: extend,
    toCamel: toCamel,
    warn: warn
  });

  /**
   * Set the property of an object for a given key. If something already
   * exists there, then it becomes an array containing both the old and new value.
   * @param { Object } obj - object on which to set the property
   * @param { String } key - property name
   * @param { Object } value - the value of the property to be set
   * @param { Boolean } ensureArray - ensure that the property remains an array
   * @param { Number } index - add the new item in a certain array position
   */
  function arrayishAdd(obj, key, value, ensureArray, index) {
    const dest = obj[key];
    const isArr = isArray(dest);
    const hasIndex = !isUndefined(index);

    if (dest && dest === value) return

    // if the key was never set, set it once
    if (!dest && ensureArray) obj[key] = [value];
    else if (!dest) obj[key] = value;
    // if it was an array and not yet set
    else {
      if (isArr) {
        const oldIndex = dest.indexOf(value);
        // this item never changed its position
        if (oldIndex === index) return
        // remove the item from its old position
        if (oldIndex !== -1) dest.splice(oldIndex, 1);
        // move or add the item
        if (hasIndex) {
          dest.splice(index, 0, value);
        } else {
          dest.push(value);
        }
      } else obj[key] = [dest, value];
    }
  }

  /**
   * Detect the tag implementation by a DOM node
   * @param   { Object } dom - DOM node we need to parse to get its tag implementation
   * @returns { Object } it returns an object containing the implementation of a custom tag (template and boot function)
   */
  function get(dom) {
    return dom.tagName && __TAG_IMPL[getAttribute(dom, IS_DIRECTIVE) ||
      getAttribute(dom, IS_DIRECTIVE) || dom.tagName.toLowerCase()]
  }

  /**
   * Get the tag name of any DOM node
   * @param   { Object } dom - DOM node we want to parse
   * @param   { Boolean } skipDataIs - hack to ignore the data-is attribute when attaching to parent
   * @returns { String } name to identify this dom node in riot
   */
  function getName(dom, skipDataIs) {
    const child = get(dom);
    const namedTag = !skipDataIs && getAttribute(dom, IS_DIRECTIVE);
    return namedTag && !tmpl.hasExpr(namedTag) ?
      namedTag : child ? child.name : dom.tagName.toLowerCase()
  }

  /**
   * Return a temporary context containing also the parent properties
   * @this Tag
   * @param { Tag } - temporary tag context containing all the parent properties
   */
  function inheritParentProps() {
    if (this.parent) return extend(create(this), this.parent)
    return this
  }

  /*
    Includes hacks needed for the Internet Explorer version 9 and below
    See: http://kangax.github.io/compat-table/es5/#ie8
         http://codeplanet.io/dropping-ie8/
  */

  const
    reHasYield  = /<yield\b/i,
    reYieldAll  = /<yield\s*(?:\/>|>([\S\s]*?)<\/yield\s*>|>)/ig,
    reYieldSrc  = /<yield\s+to=['"]([^'">]*)['"]\s*>([\S\s]*?)<\/yield\s*>/ig,
    reYieldDest = /<yield\s+from=['"]?([-\w]+)['"]?\s*(?:\/>|>([\S\s]*?)<\/yield\s*>)/ig,
    rootEls = { tr: 'tbody', th: 'tr', td: 'tr', col: 'colgroup' },
    tblTags = IE_VERSION && IE_VERSION < 10 ? RE_SPECIAL_TAGS : RE_SPECIAL_TAGS_NO_OPTION,
    GENERIC = 'div',
    SVG = 'svg';


  /*
    Creates the root element for table or select child elements:
    tr/th/td/thead/tfoot/tbody/caption/col/colgroup/option/optgroup
  */
  function specialTags(el, tmpl, tagName) {

    let
      select = tagName[0] === 'o',
      parent = select ? 'select>' : 'table>';

    // trim() is important here, this ensures we don't have artifacts,
    // so we can check if we have only one element inside the parent
    el.innerHTML = '<' + parent + tmpl.trim() + '</' + parent;
    parent = el.firstChild;

    // returns the immediate parent if tr/th/td/col is the only element, if not
    // returns the whole tree, as this can include additional elements
    /* istanbul ignore next */
    if (select) {
      parent.selectedIndex = -1;  // for IE9, compatible w/current riot behavior
    } else {
      // avoids insertion of cointainer inside container (ex: tbody inside tbody)
      const tname = rootEls[tagName];
      if (tname && parent.childElementCount === 1) parent = $(tname, parent);
    }
    return parent
  }

  /*
    Replace the yield tag from any tag template with the innerHTML of the
    original tag in the page
  */
  function replaceYield(tmpl, html) {
    // do nothing if no yield
    if (!reHasYield.test(tmpl)) return tmpl

    // be careful with #1343 - string on the source having `$1`
    const src = {};

    html = html && html.replace(reYieldSrc, function (_, ref, text) {
      src[ref] = src[ref] || text;   // preserve first definition
      return ''
    }).trim();

    return tmpl
      .replace(reYieldDest, function (_, ref, def) {  // yield with from - to attrs
        return src[ref] || def || ''
      })
      .replace(reYieldAll, function (_, def) {        // yield without any "from"
        return html || def || ''
      })
  }

  /**
   * Creates a DOM element to wrap the given content. Normally an `DIV`, but can be
   * also a `TABLE`, `SELECT`, `TBODY`, `TR`, or `COLGROUP` element.
   *
   * @param   { String } tmpl  - The template coming from the custom tag definition
   * @param   { String } html - HTML content that comes from the DOM element where you
   *           will mount the tag, mostly the original tag in the page
   * @param   { Boolean } isSvg - true if the root node is an svg
   * @returns { HTMLElement } DOM element with _tmpl_ merged through `YIELD` with the _html_.
   */
  function mkdom(tmpl, html, isSvg) {
    const match   = tmpl && tmpl.match(/^\s*<([-\w]+)/);
    const  tagName = match && match[1].toLowerCase();
    let el = makeElement(isSvg ? SVG : GENERIC);

    // replace all the yield tags with the tag inner html
    tmpl = replaceYield(tmpl, html);

    /* istanbul ignore next */
    if (tblTags.test(tagName))
      el = specialTags(el, tmpl, tagName);
    else
      setInnerHTML(el, tmpl, isSvg);

    return el
  }

  const EVENT_ATTR_RE = /^on/;

  /**
   * True if the event attribute starts with 'on'
   * @param   { String } attribute - event attribute
   * @returns { Boolean }
   */
  function isEventAttribute(attribute) {
    return EVENT_ATTR_RE.test(attribute)
  }

  /**
   * Loop backward all the parents tree to detect the first custom parent tag
   * @param   { Object } tag - a Tag instance
   * @returns { Object } the instance of the first custom parent tag found
   */
  function getImmediateCustomParent(tag) {
    let ptag = tag;
    while (ptag.__.isAnonymous) {
      if (!ptag.parent) break
      ptag = ptag.parent;
    }
    return ptag
  }

  /**
   * Trigger DOM events
   * @param   { HTMLElement } dom - dom element target of the event
   * @param   { Function } handler - user function
   * @param   { Object } e - event object
   */
  function handleEvent(dom, handler, e) {
    let ptag = this.__.parent;
    let item = this.__.item;

    if (!item)
      while (ptag && !item) {
        item = ptag.__.item;
        ptag = ptag.__.parent;
      }

    // override the event properties
    /* istanbul ignore next */
    if (isWritable(e, 'currentTarget')) e.currentTarget = dom;
    /* istanbul ignore next */
    if (isWritable(e, 'target')) e.target = e.srcElement;
    /* istanbul ignore next */
    if (isWritable(e, 'which')) e.which = e.charCode || e.keyCode;

    e.item = item;

    handler.call(this, e);

    // avoid auto updates
    if (!s.autoUpdate) return

    if (!e.preventUpdate) {
      const p = getImmediateCustomParent(this);
      // fixes #2083
      if (p.isMounted) p.update();
    }
  }

  /**
   * Attach an event to a DOM node
   * @param { String } name - event name
   * @param { Function } handler - event callback
   * @param { Object } dom - dom node
   * @param { Tag } tag - tag instance
   */
  function setEventHandler(name, handler, dom, tag) {
    let eventName;
    const cb = handleEvent.bind(tag, dom, handler);

    // avoid to bind twice the same event
    // possible fix for #2332
    dom[name] = null;

    // normalize event name
    eventName = name.replace(RE_EVENTS_PREFIX, '');

    // cache the listener into the listeners array
    if (!contains(tag.__.listeners, dom)) tag.__.listeners.push(dom);
    if (!dom[RIOT_EVENTS_KEY]) dom[RIOT_EVENTS_KEY] = {};
    if (dom[RIOT_EVENTS_KEY][name]) dom.removeEventListener(eventName, dom[RIOT_EVENTS_KEY][name]);

    dom[RIOT_EVENTS_KEY][name] = cb;
    dom.addEventListener(eventName, cb, false);
  }

  /**
   * Create a new child tag including it correctly into its parent
   * @param   { Object } child - child tag implementation
   * @param   { Object } opts - tag options containing the DOM node where the tag will be mounted
   * @param   { String } innerHTML - inner html of the child node
   * @param   { Object } parent - instance of the parent tag including the child custom tag
   * @returns { Object } instance of the new child tag just created
   */
  function initChild(child, opts, innerHTML, parent) {
    const tag = createTag(child, opts, innerHTML);
    const tagName = opts.tagName || getName(opts.root, true);
    const ptag = getImmediateCustomParent(parent);
    // fix for the parent attribute in the looped elements
    define(tag, 'parent', ptag);
    // store the real parent tag
    // in some cases this could be different from the custom parent tag
    // for example in nested loops
    tag.__.parent = parent;

    // add this tag to the custom parent tag
    arrayishAdd(ptag.tags, tagName, tag);

    // and also to the real parent tag
    if (ptag !== parent)
      arrayishAdd(parent.tags, tagName, tag);

    return tag
  }

  /**
   * Removes an item from an object at a given key. If the key points to an array,
   * then the item is just removed from the array.
   * @param { Object } obj - object on which to remove the property
   * @param { String } key - property name
   * @param { Object } value - the value of the property to be removed
   * @param { Boolean } ensureArray - ensure that the property remains an array
  */
  function arrayishRemove(obj, key, value, ensureArray) {
    if (isArray(obj[key])) {
      let index = obj[key].indexOf(value);
      if (index !== -1) obj[key].splice(index, 1);
      if (!obj[key].length) delete obj[key];
      else if (obj[key].length === 1 && !ensureArray) obj[key] = obj[key][0];
    } else if (obj[key] === value)
      delete obj[key]; // otherwise just delete the key
  }

  /**
   * Adds the elements for a virtual tag
   * @this Tag
   * @param { Node } src - the node that will do the inserting or appending
   * @param { Tag } target - only if inserting, insert before this tag's first child
   */
  function makeVirtual(src, target) {
    const head = createDOMPlaceholder();
    const tail = createDOMPlaceholder();
    const frag = createFragment();
    let sib;
    let el;

    this.root.insertBefore(head, this.root.firstChild);
    this.root.appendChild(tail);

    this.__.head = el = head;
    this.__.tail = tail;

    while (el) {
      sib = el.nextSibling;
      frag.appendChild(el);
      this.__.virts.push(el); // hold for unmounting
      el = sib;
    }

    if (target)
      src.insertBefore(frag, target.__.head);
    else
      src.appendChild(frag);
  }

  /**
   * makes a tag virtual and replaces a reference in the dom
   * @this Tag
   * @param { tag } the tag to make virtual
   * @param { ref } the dom reference location
   */
  function makeReplaceVirtual(tag, ref) {
    if (!ref.parentNode) return
    const frag = createFragment();
    makeVirtual.call(tag, frag);
    ref.parentNode.replaceChild(frag, ref);
  }

  /**
   * Update dynamically created data-is tags with changing expressions
   * @param { Object } expr - expression tag and expression info
   * @param { Tag }    parent - parent for tag creation
   * @param { String } tagName - tag implementation we want to use
   */
  function updateDataIs(expr, parent, tagName) {
    let tag = expr.tag || expr.dom._tag;
    let ref;

    const { head } = tag ? tag.__ : {};
    const isVirtual = expr.dom.tagName === 'VIRTUAL';

    if (tag && expr.tagName === tagName) {
      tag.update();
      return
    }

    // sync _parent to accommodate changing tagnames
    if (tag) {
      // need placeholder before unmount
      if(isVirtual) {
        ref = createDOMPlaceholder();
        head.parentNode.insertBefore(ref, head);
      }

      tag.unmount(true);
    }

    // unable to get the tag name
    if (!isString(tagName)) return

    expr.impl = __TAG_IMPL[tagName];

    // unknown implementation
    if (!expr.impl) return

    expr.tag = tag = initChild(
      expr.impl, {
        root: expr.dom,
        parent,
        tagName
      },
      expr.dom.innerHTML,
      parent
    );

    each(expr.attrs, a => setAttribute(tag.root, a.name, a.value));
    expr.tagName = tagName;
    tag.mount();

    // root exist first time, after use placeholder
    if (isVirtual) makeReplaceVirtual(tag, ref || tag.root);

    // parent is the placeholder tag, not the dynamic tag so clean up
    parent.__.onUnmount = () => {
      const delName = tag.opts.dataIs;
      arrayishRemove(tag.parent.tags, delName, tag);
      arrayishRemove(tag.__.parent.tags, delName, tag);
      tag.unmount();
    };
  }

  /**
   * Nomalize any attribute removing the "riot-" prefix
   * @param   { String } attrName - original attribute name
   * @returns { String } valid html attribute name
   */
  function normalizeAttrName(attrName) {
    if (!attrName) return null
    attrName = attrName.replace(ATTRS_PREFIX, '');
    if (CASE_SENSITIVE_ATTRIBUTES[attrName]) attrName = CASE_SENSITIVE_ATTRIBUTES[attrName];
    return attrName
  }

  /**
   * Update on single tag expression
   * @this Tag
   * @param { Object } expr - expression logic
   * @returns { undefined }
   */
  function updateExpression(expr) {
    if (this.root && getAttribute(this.root,'virtualized')) return

    const dom = expr.dom;
    // remove the riot- prefix
    const attrName = normalizeAttrName(expr.attr);
    const isToggle = contains([SHOW_DIRECTIVE, HIDE_DIRECTIVE], attrName);
    const isVirtual = expr.root && expr.root.tagName === 'VIRTUAL';
    const { isAnonymous } = this.__;
    const parent = dom && (expr.parent || dom.parentNode);
    const { keepValueAttributes } = s;
    // detect the style attributes
    const isStyleAttr = attrName === 'style';
    const isClassAttr = attrName === 'class';
    const isValueAttr = attrName === 'value';

    let value;

    // if it's a tag we could totally skip the rest
    if (expr._riot_id) {
      if (expr.__.wasCreated) {
        expr.update();
      // if it hasn't been mounted yet, do that now.
      } else {
        expr.mount();
        if (isVirtual) {
          makeReplaceVirtual(expr, expr.root);
        }
      }
      return
    }

    // if this expression has the update method it means it can handle the DOM changes by itself
    if (expr.update) return expr.update()

    const context = isToggle && !isAnonymous ? inheritParentProps.call(this) : this;

    // ...it seems to be a simple expression so we try to calculate its value
    value = tmpl(expr.expr, context);

    const hasValue = !isBlank(value);
    const isObj = isObject(value);

    // convert the style/class objects to strings
    if (isObj) {
      if (isClassAttr) {
        value = tmpl(JSON.stringify(value), this);
      } else if (isStyleAttr) {
        value = styleObjectToString(value);
      }
    }

    // remove original attribute
    if (expr.attr &&
        (
          // the original attribute can be removed only if we are parsing the original expression
          !expr.wasParsedOnce ||
          // or its value is false
          value === false ||
          // or if its value is currently falsy...
          // We will keep the "value" attributes if the "keepValueAttributes"
          // is enabled though
          (!hasValue && (!isValueAttr || isValueAttr && !keepValueAttributes))
        )
    ) {
      // remove either riot-* attributes or just the attribute name
      removeAttribute(dom, getAttribute(dom, expr.attr) ? expr.attr : attrName);
    }

    // for the boolean attributes we don't need the value
    // we can convert it to checked=true to checked=checked
    if (expr.bool) value = value ? attrName : false;
    if (expr.isRtag) return updateDataIs(expr, this, value)
    if (expr.wasParsedOnce && expr.value === value) return

    // update the expression value
    expr.value = value;
    expr.wasParsedOnce = true;

    // if the value is an object (and it's not a style or class attribute) we can not do much more with it
    if (isObj && !isClassAttr && !isStyleAttr && !isToggle) return
    // avoid to render undefined/null values
    if (!hasValue) value = '';

    // textarea and text nodes have no attribute name
    if (!attrName) {
      // about #815 w/o replace: the browser converts the value to a string,
      // the comparison by "==" does too, but not in the server
      value += '';
      // test for parent avoids error with invalid assignment to nodeValue
      if (parent) {
        // cache the parent node because somehow it will become null on IE
        // on the next iteration
        expr.parent = parent;
        if (parent.tagName === 'TEXTAREA') {
          parent.value = value;                    // #1113
          if (!IE_VERSION) dom.nodeValue = value;  // #1625 IE throws here, nodeValue
        }                                         // will be available on 'updated'
        else dom.nodeValue = value;
      }
      return
    }

    switch (true) {
    // handle events binding
    case isFunction(value):
      if (isEventAttribute(attrName)) {
        setEventHandler(attrName, value, dom, this);
      }
      break
    // show / hide
    case isToggle:
      toggleVisibility(dom, attrName === HIDE_DIRECTIVE ? !value : value);
      break
    // handle attributes
    default:
      if (expr.bool) {
        dom[attrName] = value;
      }

      if (isValueAttr && dom.value !== value) {
        dom.value = value;
      } else if (hasValue && value !== false) {
        setAttribute(dom, attrName, value);
      }

      // make sure that in case of style changes
      // the element stays hidden
      if (isStyleAttr && dom.hidden) toggleVisibility(dom, false);
    }
  }

  /**
   * Update all the expressions in a Tag instance
   * @this Tag
   * @param { Array } expressions - expression that must be re evaluated
   */
  function update(expressions) {
    each(expressions, updateExpression.bind(this));
  }

  /**
   * We need to update opts for this tag. That requires updating the expressions
   * in any attributes on the tag, and then copying the result onto opts.
   * @this Tag
   * @param   {Boolean} isLoop - is it a loop tag?
   * @param   { Tag }  parent - parent tag node
   * @param   { Boolean }  isAnonymous - is it a tag without any impl? (a tag not registered)
   * @param   { Object }  opts - tag options
   * @param   { Array }  instAttrs - tag attributes array
   */
  function updateOpts(isLoop, parent, isAnonymous, opts, instAttrs) {
    // isAnonymous `each` tags treat `dom` and `root` differently. In this case
    // (and only this case) we don't need to do updateOpts, because the regular parse
    // will update those attrs. Plus, isAnonymous tags don't need opts anyway
    if (isLoop && isAnonymous) return
    const ctx = isLoop ? inheritParentProps.call(this) : parent || this;

    each(instAttrs, (attr) => {
      if (attr.expr) updateExpression.call(ctx, attr.expr);
      // normalize the attribute names
      opts[toCamel(attr.name).replace(ATTRS_PREFIX, '')] = attr.expr ? attr.expr.value : attr.value;
    });
  }

  /**
   * Update the tag expressions and options
   * @param { Tag } tag - tag object
   * @param { * } data - data we want to use to extend the tag properties
   * @param { Array } expressions - component expressions array
   * @returns { Tag } the current tag instance
   */
  function componentUpdate(tag, data, expressions) {
    const __ = tag.__;
    const nextOpts = {};
    const canTrigger = tag.isMounted && !__.skipAnonymous;

    // inherit properties from the parent tag
    if (__.isAnonymous && __.parent) extend(tag, __.parent);
    extend(tag, data);

    updateOpts.apply(tag, [__.isLoop, __.parent, __.isAnonymous, nextOpts, __.instAttrs]);

    if (
      canTrigger &&
      tag.isMounted &&
      isFunction(tag.shouldUpdate) && !tag.shouldUpdate(data, nextOpts)
    ) {
      return tag
    }

    extend(tag.opts, nextOpts);

    if (canTrigger) tag.trigger('update', data);
    update.call(tag, expressions);
    if (canTrigger) tag.trigger('updated');

    return tag
  }

  /**
   * Get selectors for tags
   * @param   { Array } tags - tag names to select
   * @returns { String } selector
   */
  function query(tags) {
    // select all tags
    if (!tags) {
      const keys = Object.keys(__TAG_IMPL);
      return keys + query(keys)
    }

    return tags
      .filter(t => !/[^-\w]/.test(t))
      .reduce((list, t) => {
        const name = t.trim().toLowerCase();
        return list + `,[${IS_DIRECTIVE}="${name}"]`
      }, '')
  }

  /**
   * Another way to create a riot tag a bit more es6 friendly
   * @param { HTMLElement } el - tag DOM selector or DOM node/s
   * @param { Object } opts - tag logic
   * @returns { Tag } new riot tag instance
   */
  function Tag(el, opts) {
    // get the tag properties from the class constructor
    const {name, tmpl, css, attrs, onCreate} = this;
    // register a new tag and cache the class prototype
    if (!__TAG_IMPL[name]) {
      tag(name, tmpl, css, attrs, onCreate);
      // cache the class constructor
      __TAG_IMPL[name].class = this.constructor;
    }

    // mount the tag using the class instance
    mount$1(el, name, opts, this);
    // inject the component css
    if (css) styleManager.inject();

    return this
  }

  /**
   * Create a new riot tag implementation
   * @param   { String }   name - name/id of the new riot tag
   * @param   { String }   tmpl - tag template
   * @param   { String }   css - custom tag css
   * @param   { String }   attrs - root tag attributes
   * @param   { Function } fn - user function
   * @returns { String } name/id of the tag just created
   */
  function tag(name, tmpl, css, attrs, fn) {
    if (isFunction(attrs)) {
      fn = attrs;

      if (/^[\w-]+\s?=/.test(css)) {
        attrs = css;
        css = '';
      } else
        attrs = '';
    }

    if (css) {
      if (isFunction(css))
        fn = css;
      else
        styleManager.add(css, name);
    }

    name = name.toLowerCase();
    __TAG_IMPL[name] = { name, tmpl, attrs, fn };

    return name
  }

  /**
   * Create a new riot tag implementation (for use by the compiler)
   * @param   { String }   name - name/id of the new riot tag
   * @param   { String }   tmpl - tag template
   * @param   { String }   css - custom tag css
   * @param   { String }   attrs - root tag attributes
   * @param   { Function } fn - user function
   * @returns { String } name/id of the tag just created
   */
  function tag2(name, tmpl, css, attrs, fn) {
    if (css) styleManager.add(css, name);

    __TAG_IMPL[name] = { name, tmpl, attrs, fn };

    return name
  }

  /**
   * Mount a tag using a specific tag implementation
   * @param   { * } selector - tag DOM selector or DOM node/s
   * @param   { String } tagName - tag implementation name
   * @param   { Object } opts - tag logic
   * @returns { Array } new tags instances
   */
  function mount(selector, tagName, opts) {
    const tags = [];
    let elem, allTags;

    function pushTagsTo(root) {
      if (root.tagName) {
        let riotTag = getAttribute(root, IS_DIRECTIVE), tag;

        // have tagName? force riot-tag to be the same
        if (tagName && riotTag !== tagName) {
          riotTag = tagName;
          setAttribute(root, IS_DIRECTIVE, tagName);
        }

        tag = mount$1(
          root,
          riotTag || root.tagName.toLowerCase(),
          isFunction(opts) ? opts() : opts
        );

        if (tag)
          tags.push(tag);
      } else if (root.length)
        each(root, pushTagsTo); // assume nodeList
    }

    // inject styles into DOM
    styleManager.inject();

    if (isObject(tagName) || isFunction(tagName)) {
      opts = tagName;
      tagName = 0;
    }

    // crawl the DOM to find the tag
    if (isString(selector)) {
      selector = selector === '*' ?
        // select all registered tags
        // & tags found with the riot-tag attribute set
        allTags = query() :
        // or just the ones named like the selector
        selector + query(selector.split(/, */));

      // make sure to pass always a selector
      // to the querySelectorAll function
      elem = selector ? $$(selector) : [];
    }
    else
      // probably you have passed already a tag or a NodeList
      elem = selector;

    // select all the registered and mount them inside their root elements
    if (tagName === '*') {
      // get all custom tags
      tagName = allTags || query();
      // if the root els it's just a single tag
      if (elem.tagName)
        elem = $$(tagName, elem);
      else {
        // select all the children for all the different root elements
        var nodeList = [];

        each(elem, _el => nodeList.push($$(tagName, _el)));

        elem = nodeList;
      }
      // get rid of the tagName
      tagName = 0;
    }

    pushTagsTo(elem);

    return tags
  }

  // Create a mixin that could be globally shared across all the tags
  const mixins = {};
  const globals = mixins[GLOBAL_MIXIN] = {};
  let mixins_id = 0;

  /**
   * Create/Return a mixin by its name
   * @param   { String }  name - mixin name (global mixin if object)
   * @param   { Object }  mix - mixin logic
   * @param   { Boolean } g - is global?
   * @returns { Object }  the mixin logic
   */
  function mixin(name, mix, g) {
    // Unnamed global
    if (isObject(name)) {
      mixin(`__${mixins_id++}__`, name, true);
      return
    }

    const store = g ? globals : mixins;

    // Getter
    if (!mix) {
      if (isUndefined(store[name]))
        throw new Error(`Unregistered mixin: ${ name }`)

      return store[name]
    }

    // Setter
    store[name] = isFunction(mix) ?
      extend(mix.prototype, store[name] || {}) && mix :
      extend(store[name] || {}, mix);
  }

  /**
   * Update all the tags instances created
   * @returns { Array } all the tags instances
   */
  function update$1() {
    return each(__TAGS_CACHE, tag => tag.update())
  }

  function unregister(name) {
    styleManager.remove(name);
    return delete __TAG_IMPL[name]
  }

  const version = 'WIP';

  var core = /*#__PURE__*/Object.freeze({
    Tag: Tag,
    tag: tag,
    tag2: tag2,
    mount: mount,
    mixin: mixin,
    update: update$1,
    unregister: unregister,
    version: version
  });

  /**
   * Add a mixin to this tag
   * @returns { Tag } the current tag instance
   */
  function componentMixin(tag, ...mixins) {
    each(mixins, (mix) => {
      let instance;
      let obj;
      let props = [];

      // properties blacklisted and will not be bound to the tag instance
      const propsBlacklist = ['init', '__proto__'];

      mix = isString(mix) ? mixin(mix) : mix;

      // check if the mixin is a function
      if (isFunction(mix)) {
        // create the new mixin instance
        instance = new mix();
      } else instance = mix;

      const proto = Object.getPrototypeOf(instance);

      // build multilevel prototype inheritance chain property list
      do props = props.concat(Object.getOwnPropertyNames(obj || instance));
      while (obj = Object.getPrototypeOf(obj || instance))

      // loop the keys in the function prototype or the all object keys
      each(props, (key) => {
        // bind methods to tag
        // allow mixins to override other properties/parent mixins
        if (!contains(propsBlacklist, key)) {
          // check for getters/setters
          const descriptor = getPropDescriptor(instance, key) || getPropDescriptor(proto, key);
          const hasGetterSetter = descriptor && (descriptor.get || descriptor.set);

          // apply method only if it does not already exist on the instance
          if (!tag.hasOwnProperty(key) && hasGetterSetter) {
            Object.defineProperty(tag, key, descriptor);
          } else {
            tag[key] = isFunction(instance[key]) ?
              instance[key].bind(tag) :
              instance[key];
          }
        }
      });

      // init method will be called automatically
      if (instance.init)
        instance.init.bind(tag)(tag.opts);
    });

    return tag
  }

  /**
   * Move the position of a custom tag in its parent tag
   * @this Tag
   * @param   { String } tagName - key where the tag was stored
   * @param   { Number } newPos - index where the new tag will be stored
   */
  function moveChild(tagName, newPos) {
    const parent = this.parent;
    let tags;
    // no parent no move
    if (!parent) return

    tags = parent.tags[tagName];

    if (isArray(tags))
      tags.splice(newPos, 0, tags.splice(tags.indexOf(this), 1)[0]);
    else arrayishAdd(parent.tags, tagName, this);
  }

  /**
   * Move virtual tag and all child nodes
   * @this Tag
   * @param { Node } src  - the node that will do the inserting
   * @param { Tag } target - insert before this tag's first child
   */
  function moveVirtual(src, target) {
    let el = this.__.head;
    let sib;
    const frag = createFragment();

    while (el) {
      sib = el.nextSibling;
      frag.appendChild(el);
      el = sib;
      if (el === this.__.tail) {
        frag.appendChild(el);
        src.insertBefore(frag, target.__.head);
        break
      }
    }
  }

  /**
   * Convert the item looped into an object used to extend the child tag properties
   * @param   { Object } expr - object containing the keys used to extend the children tags
   * @param   { * } key - value to assign to the new object returned
   * @param   { * } val - value containing the position of the item in the array
   * @returns { Object } - new object containing the values of the original item
   *
   * The variables 'key' and 'val' are arbitrary.
   * They depend on the collection type looped (Array, Object)
   * and on the expression used on the each tag
   *
   */
  function mkitem(expr, key, val) {
    const item = {};
    item[expr.key] = key;
    if (expr.pos) item[expr.pos] = val;
    return item
  }

  /**
   * Unmount the redundant tags
   * @param   { Array } items - array containing the current items to loop
   * @param   { Array } tags - array containing all the children tags
   */
  function unmountRedundant(items, tags, filteredItemsCount) {
    let i = tags.length;
    const j = items.length - filteredItemsCount;

    while (i > j) {
      i--;
      remove.apply(tags[i], [tags, i]);
    }
  }


  /**
   * Remove a child tag
   * @this Tag
   * @param   { Array } tags - tags collection
   * @param   { Number } i - index of the tag to remove
   */
  function remove(tags, i) {
    tags.splice(i, 1);
    this.unmount();
    arrayishRemove(this.parent, this, this.__.tagName, true);
  }

  /**
   * Move the nested custom tags in non custom loop tags
   * @this Tag
   * @param   { Number } i - current position of the loop tag
   */
  function moveNestedTags(i) {
    each(Object.keys(this.tags), (tagName) => {
      moveChild.apply(this.tags[tagName], [tagName, i]);
    });
  }

  /**
   * Move a child tag
   * @this Tag
   * @param   { HTMLElement } root - dom node containing all the loop children
   * @param   { Tag } nextTag - instance of the next tag preceding the one we want to move
   * @param   { Boolean } isVirtual - is it a virtual tag?
   */
  function move(root, nextTag, isVirtual) {
    if (isVirtual)
      moveVirtual.apply(this, [root, nextTag]);
    else
      safeInsert(root, this.root, nextTag.root);
  }

  /**
   * Insert and mount a child tag
   * @this Tag
   * @param   { HTMLElement } root - dom node containing all the loop children
   * @param   { Tag } nextTag - instance of the next tag preceding the one we want to insert
   * @param   { Boolean } isVirtual - is it a virtual tag?
   */
  function insert(root, nextTag, isVirtual) {
    if (isVirtual)
      makeVirtual.apply(this, [root, nextTag]);
    else
      safeInsert(root, this.root, nextTag.root);
  }

  /**
   * Append a new tag into the DOM
   * @this Tag
   * @param   { HTMLElement } root - dom node containing all the loop children
   * @param   { Boolean } isVirtual - is it a virtual tag?
   */
  function append(root, isVirtual) {
    if (isVirtual)
      makeVirtual.call(this, root);
    else
      root.appendChild(this.root);
  }

  /**
   * Return the value we want to use to lookup the postion of our items in the collection
   * @param   { String }  keyAttr         - lookup string or expression
   * @param   { * }       originalItem    - original item from the collection
   * @param   { Object }  keyedItem       - object created by riot via { item, i in collection }
   * @param   { Boolean } hasKeyAttrExpr  - flag to check whether the key is an expression
   * @returns { * } value that we will use to figure out the item position via collection.indexOf
   */
  function getItemId(keyAttr, originalItem, keyedItem, hasKeyAttrExpr) {
    if (keyAttr) {
      return hasKeyAttrExpr ?  tmpl(keyAttr, keyedItem) :  originalItem[keyAttr]
    }

    return originalItem
  }

  /**
   * Manage tags having the 'each'
   * @param   { HTMLElement } dom - DOM node we need to loop
   * @param   { Tag } parent - parent tag instance where the dom node is contained
   * @param   { String } expr - string contained in the 'each' attribute
   * @returns { Object } expression object for this each loop
   */
  function _each(dom, parent, expr) {
    const mustReorder = typeof getAttribute(dom, LOOP_NO_REORDER_DIRECTIVE) !== T_STRING || removeAttribute(dom, LOOP_NO_REORDER_DIRECTIVE);
    const keyAttr = getAttribute(dom, KEY_DIRECTIVE);
    const hasKeyAttrExpr = keyAttr ? tmpl.hasExpr(keyAttr) : false;
    const tagName = getName(dom);
    const impl = __TAG_IMPL[tagName];
    const parentNode = dom.parentNode;
    const placeholder = createDOMPlaceholder();
    const child = get(dom);
    const ifExpr = getAttribute(dom, CONDITIONAL_DIRECTIVE);
    const tags = [];
    const isLoop = true;
    const innerHTML = dom.innerHTML;
    const isAnonymous = !__TAG_IMPL[tagName];
    const isVirtual = dom.tagName === 'VIRTUAL';
    let oldItems = [];

    // remove the each property from the original tag
    removeAttribute(dom, LOOP_DIRECTIVE);
    removeAttribute(dom, KEY_DIRECTIVE);

    // parse the each expression
    expr = tmpl.loopKeys(expr);
    expr.isLoop = true;

    if (ifExpr) removeAttribute(dom, CONDITIONAL_DIRECTIVE);

    // insert a marked where the loop tags will be injected
    parentNode.insertBefore(placeholder, dom);
    parentNode.removeChild(dom);

    expr.update = function updateEach() {
      // get the new items collection
      expr.value = tmpl(expr.val, parent);

      let items = expr.value;
      const frag = createFragment();
      const isObject = !isArray(items) && !isString(items);
      const root = placeholder.parentNode;
      const tmpItems = [];
      const hasKeys = isObject && !!items;

      // if this DOM was removed the update here is useless
      // this condition fixes also a weird async issue on IE in our unit test
      if (!root) return

      // object loop. any changes cause full redraw
      if (isObject) {
        items = items ? Object.keys(items).map(key => mkitem(expr, items[key], key)) : [];
      }

      // store the amount of filtered items
      let filteredItemsCount = 0;

      // loop all the new items
      each(items, (_item, index) => {
        const i = index - filteredItemsCount;
        const item = !hasKeys && expr.key ? mkitem(expr, _item, index) : _item;

        // skip this item because it must be filtered
        if (ifExpr && !tmpl(ifExpr, extend(create(parent), item))) {
          filteredItemsCount ++;
          return
        }

        const itemId = getItemId(keyAttr, _item, item, hasKeyAttrExpr);
        // reorder only if the items are not objects
        // or a key attribute has been provided
        const doReorder = !isObject && mustReorder && typeof _item === T_OBJECT || keyAttr;
        const oldPos = oldItems.indexOf(itemId);
        const isNew = oldPos === -1;
        const pos = !isNew && doReorder ? oldPos : i;
        // does a tag exist in this position?
        let tag = tags[pos];
        const mustAppend = i >= oldItems.length;
        const mustCreate = doReorder && isNew || !doReorder && !tag || !tags[i];

        // new tag
        if (mustCreate) {
          tag = createTag(impl, {
            parent,
            isLoop,
            isAnonymous,
            tagName,
            root: dom.cloneNode(isAnonymous),
            item,
            index: i,
          }, innerHTML);

          // mount the tag
          tag.mount();

          if (mustAppend)
            append.apply(tag, [frag || root, isVirtual]);
          else
            insert.apply(tag, [root, tags[i], isVirtual]);

          if (!mustAppend) oldItems.splice(i, 0, item);
          tags.splice(i, 0, tag);
          if (child) arrayishAdd(parent.tags, tagName, tag, true);
        } else if (pos !== i && doReorder) {
          // move
          if (keyAttr || contains(items, oldItems[pos])) {
            move.apply(tag, [root, tags[i], isVirtual]);
            // move the old tag instance
            tags.splice(i, 0, tags.splice(pos, 1)[0]);
            // move the old item
            oldItems.splice(i, 0, oldItems.splice(pos, 1)[0]);
          }

          // update the position attribute if it exists
          if (expr.pos) tag[expr.pos] = i;

          // if the loop tags are not custom
          // we need to move all their custom tags into the right position
          if (!child && tag.tags) moveNestedTags.call(tag, i);
        }

        // cache the original item to use it in the events bound to this node
        // and its children
        extend(tag.__, {
          item,
          index: i,
          parent
        });

        tmpItems[i] = itemId;

        if (!mustCreate) tag.update(item);
      });

      // remove the redundant tags
      unmountRedundant(items, tags, filteredItemsCount);

      // clone the items array
      oldItems = tmpItems.slice();

      root.insertBefore(frag, placeholder);
    };

    expr.unmount = () => {
      each(tags, t => { t.unmount(); });
    };

    return expr
  }

  var RefExpr = {
    init(dom, parent, attrName, attrValue) {
      this.dom = dom;
      this.attr = attrName;
      this.rawValue = attrValue;
      this.parent = parent;
      this.hasExp = tmpl.hasExpr(attrValue);
      return this
    },
    update() {
      const old = this.value;
      const customParent = this.parent && getImmediateCustomParent(this.parent);
      // if the referenced element is a custom tag, then we set the tag itself, rather than DOM
      const tagOrDom = this.dom.__ref || this.tag || this.dom;

      this.value = this.hasExp ? tmpl(this.rawValue, this.parent) : this.rawValue;

      // the name changed, so we need to remove it from the old key (if present)
      if (!isBlank(old) && customParent) arrayishRemove(customParent.refs, old, tagOrDom);
      if (!isBlank(this.value) && isString(this.value)) {
        // add it to the refs of parent tag (this behavior was changed >=3.0)
        if (customParent) arrayishAdd(
          customParent.refs,
          this.value,
          tagOrDom,
          // use an array if it's a looped node and the ref is not an expression
          null,
          this.parent.__.index
        );

        if (this.value !== old) {
          setAttribute(this.dom, this.attr, this.value);
        }
      } else {
        removeAttribute(this.dom, this.attr);
      }

      // cache the ref bound to this dom node
      // to reuse it in future (see also #2329)
      if (!this.dom.__ref) this.dom.__ref = tagOrDom;
    },
    unmount() {
      const tagOrDom = this.tag || this.dom;
      const customParent = this.parent && getImmediateCustomParent(this.parent);
      if (!isBlank(this.value) && customParent)
        arrayishRemove(customParent.refs, this.value, tagOrDom);
    }
  };

  /**
   * Create a new ref directive
   * @param   { HTMLElement } dom - dom node having the ref attribute
   * @param   { Tag } context - tag instance where the DOM node is located
   * @param   { String } attrName - either 'ref' or 'data-ref'
   * @param   { String } attrValue - value of the ref attribute
   * @returns { RefExpr } a new RefExpr object
   */
  function createRefDirective(dom, tag, attrName, attrValue) {
    return create(RefExpr).init(dom, tag, attrName, attrValue)
  }

  /**
   * Trigger the unmount method on all the expressions
   * @param   { Array } expressions - DOM expressions
   */
  function unmountAll(expressions) {
    each(expressions, expr => {
      if (expr.unmount) expr.unmount(true);
      else if (expr.tagName) expr.tag.unmount(true);
      else if (expr.unmount) expr.unmount();
    });
  }

  var IfExpr = {
    init(dom, tag, expr) {
      removeAttribute(dom, CONDITIONAL_DIRECTIVE);
      extend(this, { tag, expr, stub: createDOMPlaceholder(), pristine: dom });
      const p = dom.parentNode;
      p.insertBefore(this.stub, dom);
      p.removeChild(dom);

      return this
    },
    update() {
      this.value = tmpl(this.expr, this.tag);

      if (!this.stub.parentNode) return

      if (this.value && !this.current) { // insert
        this.current = this.pristine.cloneNode(true);
        this.stub.parentNode.insertBefore(this.current, this.stub);
        this.expressions = parseExpressions.apply(this.tag, [this.current, true]);
      } else if (!this.value && this.current) { // remove
        this.unmount();
        this.current = null;
        this.expressions = [];
      }

      if (this.value) update.call(this.tag, this.expressions);
    },
    unmount() {
      if (this.current) {
        if (this.current._tag) {
          this.current._tag.unmount();
        } else if (this.current.parentNode) {
          this.current.parentNode.removeChild(this.current);
        }
      }

      unmountAll(this.expressions || []);
    }
  };

  /**
   * Create a new if directive
   * @param   { HTMLElement } dom - if root dom node
   * @param   { Tag } context - tag instance where the DOM node is located
   * @param   { String } attr - if expression
   * @returns { IFExpr } a new IfExpr object
   */
  function createIfDirective(dom, tag, attr) {
    return create(IfExpr).init(dom, tag, attr)
  }

  /**
   * Walk the tag DOM to detect the expressions to evaluate
   * @this Tag
   * @param   { HTMLElement } root - root tag where we will start digging the expressions
   * @param   { Boolean } mustIncludeRoot - flag to decide whether the root must be parsed as well
   * @returns { Array } all the expressions found
   */
  function parseExpressions(root, mustIncludeRoot) {
    const expressions = [];

    walkNodes(root, (dom) => {
      const type = dom.nodeType;
      let attr;
      let tagImpl;

      if (!mustIncludeRoot && dom === root) return

      // text node
      if (type === 3 && dom.parentNode.tagName !== 'STYLE' && tmpl.hasExpr(dom.nodeValue))
        expressions.push({dom, expr: dom.nodeValue});

      if (type !== 1) return

      const isVirtual = dom.tagName === 'VIRTUAL';

      // loop. each does it's own thing (for now)
      if (attr = getAttribute(dom, LOOP_DIRECTIVE)) {
        if(isVirtual) setAttribute(dom, 'loopVirtual', true); // ignore here, handled in _each
        expressions.push(_each(dom, this, attr));
        return false
      }

      // if-attrs become the new parent. Any following expressions (either on the current
      // element, or below it) become children of this expression.
      if (attr = getAttribute(dom, CONDITIONAL_DIRECTIVE)) {
        expressions.push(createIfDirective(dom, this, attr));
        return false
      }

      if (attr = getAttribute(dom, IS_DIRECTIVE)) {
        if (tmpl.hasExpr(attr)) {
          expressions.push({
            isRtag: true,
            expr: attr,
            dom,
            attrs: [].slice.call(dom.attributes)
          });

          return false
        }
      }

      // if this is a tag, stop traversing here.
      // we ignore the root, since parseExpressions is called while we're mounting that root
      tagImpl = get(dom);

      if(isVirtual) {
        if(getAttribute(dom, 'virtualized')) {dom.parentElement.removeChild(dom); } // tag created, remove from dom
        if(!tagImpl && !getAttribute(dom, 'virtualized') && !getAttribute(dom, 'loopVirtual'))  // ok to create virtual tag
          tagImpl = { tmpl: dom.outerHTML };
      }

      if (tagImpl && (dom !== root || mustIncludeRoot)) {
        const hasIsDirective = getAttribute(dom, IS_DIRECTIVE);
        if(isVirtual && !hasIsDirective) { // handled in update
          // can not remove attribute like directives
          // so flag for removal after creation to prevent maximum stack error
          setAttribute(dom, 'virtualized', true);
          const tag = createTag(
            {tmpl: dom.outerHTML},
            {root: dom, parent: this},
            dom.innerHTML
          );

          expressions.push(tag); // no return, anonymous tag, keep parsing
        } else {
          if (hasIsDirective && isVirtual)
            warn(`Virtual tags shouldn't be used together with the "${IS_DIRECTIVE}" attribute - https://github.com/riot/riot/issues/2511`);

          expressions.push(
            initChild(
              tagImpl,
              {
                root: dom,
                parent: this
              },
              dom.innerHTML,
              this
            )
          );
          return false
        }
      }

      // attribute expressions
      parseAttributes.apply(this, [dom, dom.attributes, (attr, expr) => {
        if (!expr) return
        expressions.push(expr);
      }]);
    });

    return expressions
  }

  /**
   * Calls `fn` for every attribute on an element. If that attr has an expression,
   * it is also passed to fn.
   * @this Tag
   * @param   { HTMLElement } dom - dom node to parse
   * @param   { Array } attrs - array of attributes
   * @param   { Function } fn - callback to exec on any iteration
   */
  function parseAttributes(dom, attrs, fn) {
    each(attrs, (attr) => {
      if (!attr) return false

      const name = attr.name;
      const bool = isBoolAttr(name);
      let expr;

      if (contains(REF_DIRECTIVES, name) && dom.tagName.toLowerCase() !== YIELD_TAG) {
        expr =  createRefDirective(dom, this, name, attr.value);
      } else if (tmpl.hasExpr(attr.value)) {
        expr = {dom, expr: attr.value, attr: name, bool};
      }

      fn(attr, expr);
    });
  }

  /**
   * Manage the mount state of a tag triggering also the observable events
   * @this Tag
   * @param { Boolean } value - ..of the isMounted flag
   */
  function setMountState(value) {
    const { isAnonymous, skipAnonymous } = this.__;

    define(this, 'isMounted', value);

    if (!isAnonymous || !skipAnonymous) {
      if (value) this.trigger('mount');
      else {
        this.trigger('unmount');
        this.off('*');
        this.__.wasCreated = false;
      }
    }
  }

  /**
   * Mount the current tag instance
   * @returns { Tag } the current tag instance
   */
  function componentMount(tag, dom, expressions, opts) {
    const __ = tag.__;
    const root = __.root;
    root._tag = tag; // keep a reference to the tag just created

    // Read all the attrs on this instance. This give us the info we need for updateOpts
    parseAttributes.apply(__.parent, [root, root.attributes, (attr, expr) => {
      if (!__.isAnonymous && RefExpr.isPrototypeOf(expr)) expr.tag = tag;
      attr.expr = expr;
      __.instAttrs.push(attr);
    }]);

    // update the root adding custom attributes coming from the compiler
    walkAttributes(__.impl.attrs, (k, v) => { __.implAttrs.push({name: k, value: v}); });
    parseAttributes.apply(tag, [root, __.implAttrs, (attr, expr) => {
      if (expr) expressions.push(expr);
      else setAttribute(root, attr.name, attr.value);
    }]);

    // initialiation
    updateOpts.apply(tag, [__.isLoop, __.parent, __.isAnonymous, opts, __.instAttrs]);

    // add global mixins
    const globalMixin = mixin(GLOBAL_MIXIN);

    if (globalMixin && !__.skipAnonymous) {
      for (const i in globalMixin) {
        if (globalMixin.hasOwnProperty(i)) {
          tag.mixin(globalMixin[i]);
        }
      }
    }

    if (__.impl.fn) __.impl.fn.call(tag, opts);

    if (!__.skipAnonymous) tag.trigger('before-mount');

    // parse layout after init. fn may calculate args for nested custom tags
    each(parseExpressions.apply(tag, [dom, __.isAnonymous]), e => expressions.push(e));

    tag.update(__.item);

    if (!__.isAnonymous && !__.isInline) {
      while (dom.firstChild) root.appendChild(dom.firstChild);
    }

    define(tag, 'root', root);

    // if we need to wait that the parent "mount" or "updated" event gets triggered
    if (!__.skipAnonymous && tag.parent) {
      const p = getImmediateCustomParent(tag.parent);
      p.one(!p.isMounted ? 'mount' : 'updated', () => {
        setMountState.call(tag, true);
      });
    } else {
      // otherwise it's not a child tag we can trigger its mount event
      setMountState.call(tag, true);
    }

    tag.__.wasCreated = true;

    return tag
  }

  /**
   * Unmount the tag instance
   * @param { Boolean } mustKeepRoot - if it's true the root node will not be removed
   * @returns { Tag } the current tag instance
   */
  function tagUnmount(tag, mustKeepRoot, expressions) {
    const __ = tag.__;
    const root = __.root;
    const tagIndex = __TAGS_CACHE.indexOf(tag);
    const p = root.parentNode;

    if (!__.skipAnonymous) tag.trigger('before-unmount');

    // clear all attributes coming from the mounted tag
    walkAttributes(__.impl.attrs, (name) => {
      if (startsWith(name, ATTRS_PREFIX))
        name = name.slice(ATTRS_PREFIX.length);

      removeAttribute(root, name);
    });

    // remove all the event listeners
    tag.__.listeners.forEach((dom) => {
      Object.keys(dom[RIOT_EVENTS_KEY]).forEach((eventName) => {
        dom.removeEventListener(eventName, dom[RIOT_EVENTS_KEY][eventName]);
      });
    });

    // remove tag instance from the global tags cache collection
    if (tagIndex !== -1) __TAGS_CACHE.splice(tagIndex, 1);

    // clean up the parent tags object
    if (__.parent && !__.isAnonymous) {
      const ptag = getImmediateCustomParent(__.parent);

      if (__.isVirtual) {
        Object
          .keys(tag.tags)
          .forEach(tagName => arrayishRemove(ptag.tags, tagName, tag.tags[tagName]));
      } else {
        arrayishRemove(ptag.tags, __.tagName, tag);
      }
    }

    // unmount all the virtual directives
    if (tag.__.virts) {
      each(tag.__.virts, (v) => {
        if (v.parentNode) v.parentNode.removeChild(v);
      });
    }

    // allow expressions to unmount themselves
    unmountAll(expressions);
    each(__.instAttrs, a => a.expr && a.expr.unmount && a.expr.unmount());

    // clear the tag html if it's necessary
    if (mustKeepRoot) setInnerHTML(root, '');
    // otherwise detach the root tag from the DOM
    else if (p) p.removeChild(root);

    // custom internal unmount function to avoid relying on the observable
    if (__.onUnmount) __.onUnmount();

    // weird fix for a weird edge case #2409 and #2436
    // some users might use your software not as you've expected
    // so I need to add these dirty hacks to mitigate unexpected issues
    if (!tag.isMounted) setMountState.call(tag, true);

    setMountState.call(tag, false);

    delete root._tag;

    return tag
  }

  /**
   * Tag creation factory function
   * @constructor
   * @param { Object } impl - it contains the tag template, and logic
   * @param { Object } conf - tag options
   * @param { String } innerHTML - html that eventually we need to inject in the tag
   */
  function createTag(impl = {}, conf = {}, innerHTML) {
    const tag = conf.context || {};
    const opts = conf.opts || {};
    const parent = conf.parent;
    const isLoop = conf.isLoop;
    const isAnonymous = !!conf.isAnonymous;
    const skipAnonymous = s.skipAnonymousTags && isAnonymous;
    const item = conf.item;
    // available only for the looped nodes
    const index = conf.index;
    // All attributes on the Tag when it's first parsed
    const instAttrs = [];
    // expressions on this type of Tag
    const implAttrs = [];
    const tmpl = impl.tmpl;
    const expressions = [];
    const root = conf.root;
    const tagName = conf.tagName || getName(root);
    const isVirtual = tagName === 'virtual';
    const isInline = !isVirtual && !tmpl;
    let dom;

    if (isInline || isLoop && isAnonymous) {
      dom = root;
    } else {
      if (!isVirtual) root.innerHTML = '';
      dom = mkdom(tmpl, innerHTML, isSvg(root));
    }

    // make this tag observable
    if (!skipAnonymous) observable(tag);

    // only call unmount if we have a valid __TAG_IMPL (has name property)
    if (impl.name && root._tag) root._tag.unmount(true);

    define(tag, '__', {
      impl,
      root,
      skipAnonymous,
      implAttrs,
      isAnonymous,
      instAttrs,
      innerHTML,
      tagName,
      index,
      isLoop,
      isInline,
      item,
      parent,
      // tags having event listeners
      // it would be better to use weak maps here but we can not introduce breaking changes now
      listeners: [],
      // these vars will be needed only for the virtual tags
      virts: [],
      wasCreated: false,
      tail: null,
      head: null
    });

    // tag protected properties
    return [
      ['isMounted', false],
      // create a unique id to this tag
      // it could be handy to use it also to improve the virtual dom rendering speed
      ['_riot_id', uid()],
      ['root', root],
      ['opts', opts, { writable: true, enumerable: true }],
      ['parent', parent || null],
      // protect the "tags" and "refs" property from being overridden
      ['tags', {}],
      ['refs', {}],
      ['update', data => componentUpdate(tag, data, expressions)],
      ['mixin', (...mixins) => componentMixin(tag, ...mixins)],
      ['mount', () => componentMount(tag, dom, expressions, opts)],
      ['unmount', mustKeepRoot => tagUnmount(tag, mustKeepRoot, expressions)]
    ].reduce((acc, [key, value, opts]) => {
      define(tag, key, value, opts);
      return acc
    }, extend(tag, item))
  }

  /**
   * Mount a tag creating new Tag instance
   * @param   { Object } root - dom node where the tag will be mounted
   * @param   { String } tagName - name of the riot tag we want to mount
   * @param   { Object } opts - options to pass to the Tag instance
   * @param   { Object } ctx - optional context that will be used to extend an existing class ( used in riot.Tag )
   * @returns { Tag } a new Tag instance
   */
  function mount$1(root, tagName, opts, ctx) {
    const impl = __TAG_IMPL[tagName];
    const implClass = __TAG_IMPL[tagName].class;
    const context = ctx || (implClass ? create(implClass.prototype) : {});
    // cache the inner HTML to fix #855
    const innerHTML = root._innerHTML = root._innerHTML || root.innerHTML;
    const conf = extend({ root, opts, context }, { parent: opts ? opts.parent : null });
    let tag;

    if (impl && root) tag = createTag(impl, conf, innerHTML);

    if (tag && tag.mount) {
      tag.mount(true);
      // add this tag to the virtualDom variable
      if (!contains(__TAGS_CACHE, tag)) __TAGS_CACHE.push(tag);
    }

    return tag
  }



  var tags = /*#__PURE__*/Object.freeze({
    arrayishAdd: arrayishAdd,
    getTagName: getName,
    inheritParentProps: inheritParentProps,
    mountTo: mount$1,
    selectTags: query,
    arrayishRemove: arrayishRemove,
    getTag: get,
    initChildTag: initChild,
    moveChildTag: moveChild,
    makeReplaceVirtual: makeReplaceVirtual,
    getImmediateCustomParentTag: getImmediateCustomParent,
    makeVirtual: makeVirtual,
    moveVirtual: moveVirtual,
    unmountAll: unmountAll,
    createIfDirective: createIfDirective,
    createRefDirective: createRefDirective
  });

  /**
   * Riot public api
   */
  const settings = s;
  const util = {
    tmpl,
    brackets,
    styleManager,
    vdom: __TAGS_CACHE,
    styleNode: styleManager.styleNode,
    // export the riot internal utils as well
    dom,
    check,
    misc,
    tags
  };

  var riot$1 = extend({}, core, {
    observable: observable,
    settings,
    util,
  });

  riot$1.tag2('header_view', '<nav class="navbar navbar-light"> <div class="container"> <a class="navbar-brand" href="index.html">conduit</a> <ul class="nav navbar-nav pull-xs-right"> <li class="nav-item"> <a class="nav-link active" href="#/">Home</a> </li> <li class="nav-item"> <a class="nav-link" href="#/login">Sign In</a> </li> <li class="nav-item"> <a class="nav-link" href="#/register">Sign up</a> </li> </ul> </div> </nav>', '', '', function(opts) {
  });

  riot$1.tag2('footer_view', '<footer> <div class="container"> <a href="/" class="logo-font">conduit</a> <span class="attribution"> An interactive learning project from <a href="https://thinkster.io">Thinkster</a>. Code &amp; design licensed under MIT. </span> </div> </footer>', '', '', function(opts) {
  });

  riot$1.tag2('banner_view', '<div class="banner"> <div class="container"> <h1 class="logo-font">conduit</h1> <p>A place to share your knowledge.</p> </div> </div>', '', '', function(opts) {
  });

  riot$1.tag2('article_tab_view', '<div class="feed-toggle"> <ul class="nav nav-pills outline-active"> <li class="nav-item" each="{item in items}"> <a class="nav-link" href="{item.href}">{item.title}</a> </li> </ul> </div>', '', '', function(opts) {

  var self = this;
  self.items = [];

  });

  riot$1.tag2('articles_table_view', '<div class="article-preview" each="{article in articles}"> <div class="article-meta"> <a href="profile.html"><img riot-src="{article.author.image}"></a> <div class="info"> <a href="" class="author">{article.author.username}</a> <span class="date">January 20th</span> </div> <button class="btn btn-outline-primary btn-sm pull-xs-right"> <i class="ion-heart"></i> {article.favoritesCount} </button> </div> <a href="" class="preview-link"> <h1>{article.title} </h1> <p>{article.description}</p> <span>Read more...</span> </a> </div>', '', '', function(opts) {

  var self = this;
  self.articles = [];

  });

  riot$1.tag2('tags_view', '<div class="sidebar"> <p>Popular Tags</p> <div class="tag-list"> <a each="{tag in tagWords}" href="#/articles?tag={tag}" class="tag-pill tag-default">{tag}</a> </div> </div>', '', '', function(opts) {
      var self = this;
      self.tagWords = [];
  });

  class Article {
      constructor(title, slug, body, createdAt, updatedAt, tagList, description, author, favorited, favoritesCount) {
          this.title = title;
          this.slug = slug;
          this.body = body;
          this.createdAt = createdAt;
          this.updatedAt = updatedAt;
          this.tagList = tagList;
          this.description = description;
          this.author = author;
          this.favorited = favorited;
          this.favoritesCount = favoritesCount;
      }
  }

  class Author {
      constructor(username, image, following, bio) {
          this.username = username;
          this.image = image;
          this.following = following;
          this.bio = bio;
      }
  }

  class RootUseCase {
      constructor() {
          this.requestArticles = (completion) => {
              // stub
              // {
              //     "title": "HUI",
              //     "slug": "hui-k6rjbg",
              //     "body": "# adad\n## adad\n*qwe",
              //     "createdAt": "2019-06-20T08:09:46.868Z",
              //     "updatedAt": "2019-06-20T08:09:46.868Z",
              //     "tagList": [],
              //     "description": "DEATH",
              //     "author": {
              //         "username": "andersdeath",
              //         "bio": null,
              //         "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
              //         "following": false
              //     },
              //     "favorited": false,
              //     "favoritesCount": 0
              // },
              let articles = [
                  new Article("HUI", "hui-k6rjbg", "# adad\n## adad\n*qwe", "2019-06-20T08:09:46.868Z", "2019-06-20T08:09:46.868Z", ["hoge", "huga"], "DEATH", new Author("andersdeath", "https://static.productionready.io/images/smiley-cyrus.jpg", false, null), false, 0),
                  new Article("HUI", "hui-k6rjbg", "# adad\n## adad\n*qwe", "2019-06-20T08:09:46.868Z", "2019-06-20T08:09:46.868Z", ["hoge", "huga"], "DEATH", new Author("andersdeath", "https://static.productionready.io/images/smiley-cyrus.jpg", false, null), false, 0)
              ];
              completion(articles);
          };
          this.requestTags = (completion) => {
              let tags = [
                  "programming",
                  "javascript",
                  "emberjs",
                  "angularjs",
                  "react",
                  "mean",
                  "node",
                  "rails",
                  "php"
              ];
              completion(tags);
          };
          this.isLogin = () => {
              return false;
          };
      }
  }

  class ArticleTabItem {
      constructor(title, href) {
          this.title = title;
          this.href = href;
      }
  }

  riot$1.tag2('root_view_controller', '<header_view></header_view> <banner_view></banner_view> <div class="container page"> <div class="row"> <div class="col-md-9"> <article_tab_view></article_tab_view> <articles_table_view></articles_table_view> </div> <div class="col-md-3"> <tags_view></tags_view> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new RootUseCase();

  this.on('mount', () => {
      useCase.requestArticles( ( articles, error ) => {
          self.tags.articles_table_view.articles = articles;
          self.tags.articles_table_view.update();
      });

      useCase.requestTags( ( tags, error ) => {
          self.tags.tags_view.tagWords = tags;
          self.tags.tags_view.update();
      });

      if ( useCase.isLogin() == true ) {
          self.tags.article_tab_view.items = [
              new ArticleTabItem( "Your Feed", "#/articles"),
              new ArticleTabItem( "Global Feed", "#/articles")
          ];
          self.tags.article_tab_view.update();
      }
      else{
          self.tags.article_tab_view.items = [
              new ArticleTabItem( "Global Feed", "#/articles")
          ];
          self.tags.article_tab_view.update();
      }
  });

  });

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */

  function __awaiter(thisArg, _arguments, P, generator) {
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  }

  class LoginUseCase {
      constructor() {
          this.login = (email, password, completion) => {
              console.log("email: " + email + ", password: " + password);
              (() => __awaiter(this, void 0, void 0, function* () {
                  try {
                      const response = yield fetch("https://conduit.productionready.io/api/users/login", {
                          headers: {
                              "Accept": "application/json",
                              "Content-Type": "application/json"
                          },
                          method: "POST",
                          body: JSON.stringify({ "user": { "email": email, "password": password } })
                      });
                      const content = yield response.json();
                      console.log(JSON.stringify(content));
                      completion(null);
                  }
                  catch (error) {
                      completion(error);
                  }
              }))();
          };
      }
  }

  riot$1.tag2('login_view_controller', '<header_view></header_view> <div class="auth-page"> <div class="container page"> <div class="row"> <div class="col-md-6 offset-md-3 col-xs-12"> <h1 class="text-xs-center">Sign In</h1> <p class="text-xs-center"> <a href="#/register">Need an account?</a> </p> <ul if="{errorMessage != null}" class="error-messages"> <li>{errorMessage}</li> </ul> <fieldset class="form-group"> <input ref="emailField" class="form-control form-control-lg" type="text" placeholder="Email" oninput="{shouldSubmit}"> </fieldset> <fieldset class="form-group"> <input ref="passwordField" class="form-control form-control-lg" type="password" placeholder="Password" oninput="{shouldSubmit}"> </fieldset> <button ref="submitButton" class="btn btn-lg btn-primary pull-xs-right" onclick="{actionOfLoginButton}" disabled> Sign in </button> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new LoginUseCase();
  self.errorMessage = null;

  self.actionOfLoginButton = ( event ) => {
      useCase.login( self.refs.emailField.value, self.refs.passwordField.value, ( error ) => {
          console.log("コールバック呼ばれた");

          self.errorMessage = "email or password is invalid";
          self.update();
      });
  };

  self.shouldSubmit = ( event ) => {
      self.refs.submitButton.disabled = ( self.refs.emailField.value.length == 0 || self.refs.passwordField.value.length == 0 );
  };

  });

  riot$1.tag2('article_view_controller', '<header_view></header_view> <div class="article-page"> <div class="banner"> <div class="container"> <h1>How to build webapps that scale</h1> <div class="article-meta"> <a href=""><img src="http://i.imgur.com/Qr71crq.jpg"></a> <div class="info"> <a href="" class="author">Eric Simons</a> <span class="date">January 20th</span> </div> <button class="btn btn-sm btn-outline-secondary"> <i class="ion-plus-round"></i> &nbsp; Follow Eric Simons <span class="counter">(10)</span> </button> &nbsp;&nbsp; <button class="btn btn-sm btn-outline-primary"> <i class="ion-heart"></i> &nbsp; Favorite Post <span class="counter">(29)</span> </button> </div> </div> </div> <div class="container page"> <div class="row article-content"> <div class="col-md-12"> <p> Web development technologies have evolved at an incredible clip over the past few years. </p> <h2 id="introducing-ionic">Introducing RealWorld.</h2> <p>It\'s a great solution for learning how other frameworks work.</p> </div> </div> <hr> <div class="article-actions"> <div class="article-meta"> <a href="profile.html"><img src="http://i.imgur.com/Qr71crq.jpg"></a> <div class="info"> <a href="" class="author">Eric Simons</a> <span class="date">January 20th</span> </div> <button class="btn btn-sm btn-outline-secondary"> <i class="ion-plus-round"></i> &nbsp; Follow Eric Simons <span class="counter">(10)</span> </button> &nbsp; <button class="btn btn-sm btn-outline-primary"> <i class="ion-heart"></i> &nbsp; Favorite Post <span class="counter">(29)</span> </button> </div> </div> <div class="row"> <div class="col-xs-12 col-md-8 offset-md-2"> <form class="card comment-form"> <div class="card-block"> <textarea class="form-control" placeholder="Write a comment..." rows="3"></textarea> </div> <div class="card-footer"> <img src="http://i.imgur.com/Qr71crq.jpg" class="comment-author-img"> <button class="btn btn-sm btn-primary"> Post Comment </button> </div> </form> <div class="card"> <div class="card-block"> <p class="card-text">With supporting text below as a natural lead-in to additional content.</p> </div> <div class="card-footer"> <a href="" class="comment-author"> <img src="http://i.imgur.com/Qr71crq.jpg" class="comment-author-img"> </a> &nbsp; <a href="" class="comment-author">Jacob Schmidt</a> <span class="date-posted">Dec 29th</span> </div> </div> <div class="card"> <div class="card-block"> <p class="card-text">With supporting text below as a natural lead-in to additional content.</p> </div> <div class="card-footer"> <a href="" class="comment-author"> <img src="http://i.imgur.com/Qr71crq.jpg" class="comment-author-img"> </a> &nbsp; <a href="" class="comment-author">Jacob Schmidt</a> <span class="date-posted">Dec 29th</span> <span class="mod-options"> <i class="ion-edit"></i> <i class="ion-trash-a"></i> </span> </div> </div> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {
  });

  riot$1.tag2('editer_view_controller', '<header_view></header_view> <div class="editor-page"> <div class="container page"> <div class="row"> <div class="col-md-10 offset-md-1 col-xs-12"> <form> <fieldset> <fieldset class="form-group"> <input type="text" class="form-control form-control-lg" placeholder="Article Title"> </fieldset> <fieldset class="form-group"> <input type="text" class="form-control" placeholder="What\'s this article about?"> </fieldset> <fieldset class="form-group"> <textarea class="form-control" rows="8" placeholder="Write your article (in markdown)"></textarea> </fieldset> <fieldset class="form-group"> <input type="text" class="form-control" placeholder="Enter tags"><div class="tag-list"></div> </fieldset> <button class="btn btn-lg pull-xs-right btn-primary" type="button"> Publish Article </button> </fieldset> </form> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {
  });

  riot$1.tag2('settings_view_controller', '<header_view></header_view> <div class="settings-page"> <div class="container page"> <div class="row"> <div class="col-md-6 offset-md-3 col-xs-12"> <h1 class="text-xs-center">Your Settings</h1> <form> <fieldset> <fieldset class="form-group"> <input class="form-control" type="text" placeholder="URL of profile picture"> </fieldset> <fieldset class="form-group"> <input class="form-control form-control-lg" type="text" placeholder="Your Name"> </fieldset> <fieldset class="form-group"> <textarea class="form-control form-control-lg" rows="8" placeholder="Short bio about you"></textarea> </fieldset> <fieldset class="form-group"> <input class="form-control form-control-lg" type="text" placeholder="Email"> </fieldset> <fieldset class="form-group"> <input class="form-control form-control-lg" type="password" placeholder="Password"> </fieldset> <button class="btn btn-lg btn-primary pull-xs-right"> Update Settings </button> </fieldset> </form> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {
  });

  riot$1.tag2('profile_view_controller', '<header_view></header_view> <div class="profile-page"> <div class="user-info"> <div class="container"> <div class="row"> <div class="col-xs-12 col-md-10 offset-md-1"> <img src="http://i.imgur.com/Qr71crq.jpg" class="user-img"> <h4>Eric Simons</h4> <p> Cofounder @GoThinkster, lived in Aol\'s HQ for a few months, kinda looks like Peeta from the Hunger Games </p> <button class="btn btn-sm btn-outline-secondary action-btn"> <i class="ion-plus-round"></i> &nbsp; Follow Eric Simons </button> </div> </div> </div> </div> <div class="container"> <div class="row"> <div class="col-xs-12 col-md-10 offset-md-1"> <div class="articles-toggle"> <ul class="nav nav-pills outline-active"> <li class="nav-item"> <a class="nav-link active" href="">My Articles</a> </li> <li class="nav-item"> <a class="nav-link" href="">Favorited Articles</a> </li> </ul> </div> <div class="article-preview"> <div class="article-meta"> <a href=""><img src="http://i.imgur.com/Qr71crq.jpg"></a> <div class="info"> <a href="" class="author">Eric Simons</a> <span class="date">January 20th</span> </div> <button class="btn btn-outline-primary btn-sm pull-xs-right"> <i class="ion-heart"></i> 29 </button> </div> <a href="" class="preview-link"> <h1>How to build webapps that scale</h1> <p>This is the description for the post.</p> <span>Read more...</span> </a> </div> <div class="article-preview"> <div class="article-meta"> <a href=""><img src="http://i.imgur.com/N4VcUeJ.jpg"></a> <div class="info"> <a href="" class="author">Albert Pai</a> <span class="date">January 20th</span> </div> <button class="btn btn-outline-primary btn-sm pull-xs-right"> <i class="ion-heart"></i> 32 </button> </div> <a href="" class="preview-link"> <h1>The song you won\'t ever stop singing. No matter how hard you try.</h1> <p>This is the description for the post.</p> <span>Read more...</span> <ul class="tag-list"> <li class="tag-default tag-pill tag-outline">Music</li> <li class="tag-default tag-pill tag-outline">Song</li> </ul> </a> </div> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {
  });

  /**
   * Application Settings Container
   */
  class Settings {
      constructor() {
          this.set = (settings) => {
              this.settings = settings;
          };
          this.valueForKey = (key) => {
              if (this.settings == null) {
                  throw new Error("Must be set.");
              }
              return this.settings[key];
          };
          if (Settings._instance) {
              throw new Error("must use the shared().");
          }
          Settings._instance = this;
      }
  }
  Settings.shared = () => {
      if (Settings._instance === undefined) {
          Settings._instance = new Settings();
      }
      return Settings._instance;
  };

  /**
   * Simple client-side router
   * @module riot-route
   */

  var RE_ORIGIN = /^.+?\/\/+[^/]+/,
    EVENT_LISTENER = 'EventListener',
    REMOVE_EVENT_LISTENER = 'remove' + EVENT_LISTENER,
    ADD_EVENT_LISTENER = 'add' + EVENT_LISTENER,
    HAS_ATTRIBUTE = 'hasAttribute',
    POPSTATE = 'popstate',
    HASHCHANGE = 'hashchange',
    TRIGGER = 'trigger',
    MAX_EMIT_STACK_LEVEL = 3,
    win = typeof window != 'undefined' && window,
    doc = typeof document != 'undefined' && document,
    hist = win && history,
    loc = win && (hist.location || win.location), // see html5-history-api
    prot = Router.prototype, // to minify more
    clickEvent = doc && doc.ontouchstart ? 'touchstart' : 'click',
    central = observable();

  var
    started = false,
    routeFound = false,
    debouncedEmit,
    current,
    parser,
    secondParser,
    emitStack = [],
    emitStackLevel = 0;

  /**
   * Default parser. You can replace it via router.parser method.
   * @param {string} path - current path (normalized)
   * @returns {array} array
   */
  function DEFAULT_PARSER(path) {
    return path.split(/[/?#]/)
  }

  /**
   * Default parser (second). You can replace it via router.parser method.
   * @param {string} path - current path (normalized)
   * @param {string} filter - filter string (normalized)
   * @returns {array} array
   */
  function DEFAULT_SECOND_PARSER(path, filter) {
    var f = filter
      .replace(/\?/g, '\\?')
      .replace(/\*/g, '([^/?#]+?)')
      .replace(/\.\./, '.*');
    var re = new RegExp(("^" + f + "$"));
    var args = path.match(re);

    if (args) { return args.slice(1) }
  }

  /**
   * Simple/cheap debounce implementation
   * @param   {function} fn - callback
   * @param   {number} delay - delay in seconds
   * @returns {function} debounced function
   */
  function debounce(fn, delay) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, delay);
    }
  }

  /**
   * Set the window listeners to trigger the routes
   * @param {boolean} autoExec - see route.start
   */
  function start(autoExec) {
    debouncedEmit = debounce(emit, 1);
    win[ADD_EVENT_LISTENER](POPSTATE, debouncedEmit);
    win[ADD_EVENT_LISTENER](HASHCHANGE, debouncedEmit);
    doc[ADD_EVENT_LISTENER](clickEvent, click);

    if (autoExec) { emit(true); }
  }

  /**
   * Router class
   */
  function Router() {
    this.$ = [];
    observable(this); // make it observable
    central.on('stop', this.s.bind(this));
    central.on('emit', this.e.bind(this));
  }

  function normalize(path) {
    return path.replace(/^\/|\/$/, '')
  }

  function isString$1(str) {
    return typeof str == 'string'
  }

  /**
   * Get the part after domain name
   * @param {string} href - fullpath
   * @returns {string} path from root
   */
  function getPathFromRoot(href) {
    return (href || loc.href).replace(RE_ORIGIN, '')
  }

  /**
   * Get the part after base
   * @param {string} href - fullpath
   * @returns {string} path from base
   */
  function getPathFromBase(href) {
    var base = route._.base;
    return base[0] === '#'
      ? (href || loc.href || '').split(base)[1] || ''
      : (loc ? getPathFromRoot(href) : href || '').replace(base, '')
  }

  function emit(force) {
    // the stack is needed for redirections
    var isRoot = emitStackLevel === 0;
    if (MAX_EMIT_STACK_LEVEL <= emitStackLevel) { return }

    emitStackLevel++;
    emitStack.push(function() {
      var path = getPathFromBase();
      if (force || path !== current) {
        central[TRIGGER]('emit', path);
        current = path;
      }
    });

    if (isRoot) {
      var first;
      while (first = emitStack.shift()) { first(); } // stack increses within this call
      emitStackLevel = 0;
    }
  }

  function click(e) {
    if (
      e.which !== 1 // not left click
      || e.metaKey || e.ctrlKey || e.shiftKey // or meta keys
      || e.defaultPrevented // or default prevented
    ) { return }

    var el = e.target;
    while (el && el.nodeName !== 'A') { el = el.parentNode; }

    if (
      !el || el.nodeName !== 'A' // not A tag
      || el[HAS_ATTRIBUTE]('download') // has download attr
      || !el[HAS_ATTRIBUTE]('href') // has no href attr
      || el.target && el.target !== '_self' // another window or frame
      || el.href.indexOf(loc.href.match(RE_ORIGIN)[0]) === -1 // cross origin
    ) { return }

    var base = route._.base;

    if (el.href !== loc.href
      && (
        el.href.split('#')[0] === loc.href.split('#')[0] // internal jump
        || base[0] !== '#' && getPathFromRoot(el.href).indexOf(base) !== 0 // outside of base
        || base[0] === '#' && el.href.split(base)[0] !== loc.href.split(base)[0] // outside of #base
        || !go(getPathFromBase(el.href), el.title || doc.title) // route not found
      )) { return }

    e.preventDefault();
  }

  /**
   * Go to the path
   * @param {string} path - destination path
   * @param {string} title - page title
   * @param {boolean} shouldReplace - use replaceState or pushState
   * @returns {boolean} - route not found flag
   */
  function go(path, title, shouldReplace) {
    // Server-side usage: directly execute handlers for the path
    if (!hist) { return central[TRIGGER]('emit', getPathFromBase(path)) }

    path = route._.base + normalize(path);
    title = title || doc.title;
    // browsers ignores the second parameter `title`
    shouldReplace
      ? hist.replaceState(null, title, path)
      : hist.pushState(null, title, path);
    // so we need to set it manually
    doc.title = title;
    routeFound = false;
    emit();
    return routeFound
  }

  /**
   * Go to path or set action
   * a single string:                go there
   * two strings:                    go there with setting a title
   * two strings and boolean:        replace history with setting a title
   * a single function:              set an action on the default route
   * a string/RegExp and a function: set an action on the route
   * @param {(string|function)} first - path / action / filter
   * @param {(string|RegExp|function)} second - title / action
   * @param {boolean} third - replace flag
   */
  prot.m = function(first, second, third) {
    if (isString$1(first) && (!second || isString$1(second))) { go(first, second, third || false); }
    else if (second) { this.r(first, second); }
    else { this.r('@', first); }
  };

  /**
   * Stop routing
   */
  prot.s = function() {
    this.off('*');
    this.$ = [];
  };

  /**
   * Emit
   * @param {string} path - path
   */
  prot.e = function(path) {
    this.$.concat('@').some(function(filter) {
      var args = (filter === '@' ? parser : secondParser)(normalize(path), normalize(filter));
      if (typeof args != 'undefined') {
        this[TRIGGER].apply(null, [filter].concat(args));
        return routeFound = true // exit from loop
      }
    }, this);
  };

  /**
   * Register route
   * @param {string} filter - filter for matching to url
   * @param {function} action - action to register
   */
  prot.r = function(filter, action) {
    if (filter !== '@') {
      filter = '/' + normalize(filter);
      this.$.push(filter);
    }

    this.on(filter, action);
  };

  var mainRouter = new Router();
  var route = mainRouter.m.bind(mainRouter);

  // adding base and getPathFromBase to route so we can access them in route.tag's script
  route._ = { base: null, getPathFromBase: getPathFromBase };

  /**
   * Create a sub router
   * @returns {function} the method of a new Router object
   */
  route.create = function() {
    var newSubRouter = new Router();
    // assign sub-router's main method
    var router = newSubRouter.m.bind(newSubRouter);
    // stop only this sub-router
    router.stop = newSubRouter.s.bind(newSubRouter);
    return router
  };

  /**
   * Set the base of url
   * @param {(str|RegExp)} arg - a new base or '#' or '#!'
   */
  route.base = function(arg) {
    route._.base = arg || '#';
    current = getPathFromBase(); // recalculate current path
  };

  /** Exec routing right now **/
  route.exec = function() {
    emit(true);
  };

  /**
   * Replace the default router to yours
   * @param {function} fn - your parser function
   * @param {function} fn2 - your secondParser function
   */
  route.parser = function(fn, fn2) {
    if (!fn && !fn2) {
      // reset parser for testing...
      parser = DEFAULT_PARSER;
      secondParser = DEFAULT_SECOND_PARSER;
    }
    if (fn) { parser = fn; }
    if (fn2) { secondParser = fn2; }
  };

  /**
   * Helper function to get url query as an object
   * @returns {object} parsed query
   */
  route.query = function() {
    var q = {};
    var href = loc.href || current;
    href.replace(/[?&](.+?)=([^&]*)/g, function(_, k, v) { q[k] = v; });
    return q
  };

  /** Stop routing **/
  route.stop = function () {
    if (started) {
      if (win) {
        win[REMOVE_EVENT_LISTENER](POPSTATE, debouncedEmit);
        win[REMOVE_EVENT_LISTENER](HASHCHANGE, debouncedEmit);
        doc[REMOVE_EVENT_LISTENER](clickEvent, click);
      }

      central[TRIGGER]('stop');
      started = false;
    }
  };

  /**
   * Start routing
   * @param {boolean} autoExec - automatically exec after starting if true
   */
  route.start = function (autoExec) {
    if (!started) {
      if (win) {
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
          start(autoExec);
        } else {
          document.onreadystatechange = function () {
            if (document.readyState === 'interactive') {
              // the timeout is needed to solve
              // a weird safari bug https://github.com/riot/route/issues/33
              setTimeout(function() { start(autoExec); }, 1);
            }
          };
        }
      }

      started = true;
    }
  };

  /** Prepare the router **/
  route.base();
  route.parser();

  // import i18next from "i18next"
  class ApplicationUseCase {
      constructor() {
          this.menus = [
              {
                  identifier: "login",
                  viewControllerName: "login_view_controller"
              },
              {
                  identifier: "settings",
                  viewControllerName: "settings_view_controller"
              },
              {
                  identifier: "article",
                  viewControllerName: "article_view_controller"
              },
              {
                  identifier: "editer",
                  viewControllerName: "editer_view_controller"
              },
              {
                  identifier: "profile",
                  viewControllerName: "profile_view_controller"
              }
          ];
          this.initialize = (completion) => {
              // Download application settings.
              let requestSettings = fetch("assets/json/settings.json")
                  .then((res) => { return res.json(); })
                  .then((json) => {
                  Settings.shared().set(json);
              })
                  .catch(function (error) {
                  throw error;
              });
              // // Download loacalize strings.
              // let lang = ((window.navigator.languages && window.navigator.languages[0]) ||
              //              window.navigator.language).substr(0, 2) === "ja" ? "ja" : "en"
              // let requestLocalizedString = fetch("assets/json/i18n/" + lang + "/localize.json")
              // .then( (res) => { return res.json() })
              // .then( (json) => {
              //     let resources = {}
              //     resources[lang] = { translation: json }
              //     i18next.init({
              //         lng: lang,
              //         debug: false,
              //         resources: resources,
              //         interpolation: {
              //             format: function(value, format, lng) {
              //                 if (format === "uppercase") { return value.toUpperCase() }
              //                 if (value instanceof Date) { return moment(value).format(format) }
              //                 return value
              //             }
              //         }
              //     }, function( error, translation ) {
              //         throw error
              //     })
              // })
              // .catch((error) => {
              //     throw error
              // })
              // // Request of parallel.
              Promise.all([requestSettings /*, requestLocalizedString*/])
                  .then(() => {
                  // Start Analytics
                  // Analytics.shared().start( Settings.shared().valueForKey("analytics").trackingID )
                  // Analytics.shared().send("pageview")
                  // No error
                  // Set Title
                  document.title = Settings.shared().valueForKey("title");
                  completion(null);
              })
                  .catch((error) => {
                  // Has error
                  completion(error);
              });
          };
          this.setRoute = () => {
              route.start();
              // 404
              route(() => {
                  // Show 404 Not Found
              });
              this.menus.forEach((menu) => {
                  route("/" + menu.identifier, () => {
                      console.log("route is " + menu.identifier);
                      riot$1.mount("root_view_controller", menu.viewControllerName, menu);
                  });
              });
          };
          this.routing = () => {
              // in launch
              if (location.hash) {
                  let ident = location.hash.substr(2);
                  console.log("hash is " + ident);
                  let filterd = this.menus.filter((menu) => {
                      return menu.identifier === ident;
                  });
                  if (filterd.length > 0) {
                      let menu = filterd[0];
                      setTimeout(() => {
                          riot$1.mount("root_view_controller", menu.viewControllerName, menu);
                      }, 5);
                  }
              }
              else {
                  setTimeout(() => {
                      riot$1.mount("root_view_controller");
                  }, 5);
              }
          };
      }
  }

  riot$1.tag2('application', '<root_view_controller></root_view_controller>', '', '', function(opts) {
  var useCase = new ApplicationUseCase();

  this.on('mount', function() {
      useCase.initialize( function( error ){
      });
      useCase.setRoute();
      useCase.routing();
  });
  });

  // Import Polyfill
  // Start Application
  riot$1.mount("application");

}());
