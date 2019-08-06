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

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function commonjsRequire () {
  	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var observable = createCommonjsModule(function (module, exports) {
  (function(window, undefined$1) {var observable = function(el) {

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
    /* istanbul ignore next */
    // support CommonJS, AMD & browser
    module.exports = observable;

  })();
  });

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

  riot$1.tag2('header_view', '<nav class="navbar navbar-light"> <div class="container"> <a class="navbar-brand" href="/">conduit</a> <ul class="nav navbar-nav pull-xs-right"> <li each="{item in items}" class="nav-item"> <a class="{nav-link: true, active: item.isActive}" href="{item.href}"> &nbsp; <i if="{item.icon !== null}" class="{item.icon}"></i> <img if="{item.image !== null}" class="user-pic" riot-src="{item.image}"> {item.title} </a> </li> </ul> </div> </nav>', 'header_view .nav-link .user-pic,[data-is="header_view"] .nav-link .user-pic{ margin-right: 0px; }', '', function(opts) {

  var self = this;

  self.items = [];
  self.setItems = (items) => {
      self.items = items;
      self.update();
  };

  });

  riot$1.tag2('footer_view', '<footer> <div class="container"> <a href="/" class="logo-font">conduit</a> <span class="attribution"> An interactive learning project from <a href="https://thinkster.io">Thinkster</a>. Code &amp; design licensed under MIT. </span> </div> </footer>', '', '', function(opts) {
  });

  riot$1.tag2('banner_view', '<div class="banner"> <div class="container"> <h1 class="logo-font">conduit</h1> <p>A place to share your <a class="spotlink" href="https://v3.riotjs.now.sh" target="blank">RIOT</a> knowledge.</p> </div> </div> </div>', 'banner_view .spotlink,[data-is="banner_view"] .spotlink{ color: white; } banner_view .spotlink:hover,[data-is="banner_view"] .spotlink:hover{ color: white; text-decoration: none; }', '', function(opts) {
  });

  riot$1.tag2('article_tab_view', '<div class="{opts.toggle_style}"> <ul class="nav nav-pills outline-active"> <li class="nav-item" each="{item in items()}"> <a class="{nav-link: true, active: item.isActive}" onclick="{actionOfClickTab}">{item.title}</a> </li> </ul> </div>', '', '', function(opts) {

  var self = this;
  var _items = null;

  self.didSelectTab = () => {};

  self.setItems = ( items ) => {
      _items = items;
      self.update();
  };

  self.items = () => {
      return _items
  };

  self.actionOfClickTab = (event) => {
      self.didSelectTab( event.item.item );
  };

  });

  riot$1.tag2('articles_table_view', '<div class="article-preview" each="{article in articles}"> <div class="article-meta"> <a onclick="{actionOfClickProfile}"><img riot-src="{article.author.image}"></a> <div class="info"> <a class="author author-link" onclick="{actionOfClickProfile}">{article.author.username}</a> <span class="date">January 20th</span> </div> <button onclick="{actionOfFavoriteButton}" class="{btn: true, btn-sm: true, pull-xs-right: true, btn-primary: article.favorited, btn-outline-primary: !article.favorited}"> <i class="ion-heart"></i> {article.favoritesCount} </button> </div> <a class="preview-link" onclick="{actionOfClickArticle}"> <h1>{article.title} </h1> <p>{article.description}</p> <span>Read more...</span> <ul class="tag-list"> <li each="{tagWord in article.tagList}" class="tag-default tag-pill tag-outline">{tagWord}</li> </ul> </a> </div>', 'articles_table_view .author-link,[data-is="articles_table_view"] .author-link{ color: #5cb85c; cursor : pointer; text-decoration: none; } articles_table_view .author-link:hover,[data-is="articles_table_view"] .author-link:hover{ color: #5cb85c; text-decoration: underline; }', '', function(opts) {

  var self = this;

  self.articles = [];
  self.setArticles = ( articles ) => {
      self.articles = articles;
      self.update();
  };

  self.didSelectProfile  = () => {};
  self.actionOfClickProfile  = (event) => {
      self.didSelectProfile ( event.item.article.author );
  };

  self.didSelectArticle = () => {};
  self.actionOfClickArticle = (event) => {
      self.didSelectArticle( event.item.article );
  };

  self.didFavorite = () => {};
  self.actionOfFavoriteButton = (event) => {
      self.didFavorite( event.item.article );
  };

  });

  riot$1.tag2('tags_view', '<div class="sidebar"> <p>Popular Tags</p> <div class="tag-list"> <a each="{tag in tagWords}" href="#/articles/tag/{tag}" class="tag-pill tag-default">{tag}</a> </div> </div>', '', '', function(opts) {
      var self = this;

      self.tagWords = [];
      self.setTagWords = ( tagWords  ) => {
          self.tagWords = tagWords;
          self.update();
      };

  });

  riot$1.tag2('pagenation_view', '<ul class="pagination" if="{isShow}"> <li each="{page in arrayOfPageNumber()}" class="{page-item: true, active: page === shownPage}"> <a class="page-link" onclick="{actionOfClickPageLink}">{page}</a> </li> </ul>', '', '', function(opts) {

  var self = this;
  var countOfPage = 0;

  self.shownPage = 1;

  self.didSelectPageNumber = () => {};

  self.setCountOfPage = ( count ) => {
      countOfPage = count === null ? 0 : count;
      self.update();
  };
  self.isShow = () => {
      return countOfPage > 0
  };

  self.pagesCount = () => {
      return countOfPage
  };

  self.arrayOfPageNumber = () => {
      return [...Array(countOfPage).keys()].map(i => ++i)
  };

  self.actionOfClickPageLink = (event) =>{
      self.didSelectPageNumber( event.item.page );
  };

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

  class Profile {
      constructor(username, bio, image, following) {
          this.username = username;
          this.bio = bio;
          this.image = image;
          this.following = following;
      }
  }
  Profile.init = (object) => {
      return new Profile(object.username, object.bio, object.image, object.following);
  };

  class User {
      constructor(id, email, createdAt, updatedAt, username, token, bio, image) {
          this.profile = () => {
              return new Profile(this.username, this.bio, this.image, false);
          };
          this.id = id;
          this.email = email;
          this.createdAt = createdAt;
          this.updatedAt = updatedAt;
          this.username = username;
          this.token = token;
          this.bio = bio;
          this.image = image;
      }
  }
  User.init = (object) => {
      return new User(object.id, object.email, object.createdAt, object.updatedAt, object.username, object.token, object.bio, object.image);
  };
  // {"user":
  //     {"id":58598,
  //     "email":"buyer01@ahk.jp",
  //     "createdAt":"2019-06-20T02:56:36.621Z",
  //     "updatedAt":"2019-06-20T02:56:36.630Z",
  //     "username":"arupaka2525",
  //     "bio":null,
  //     "image":null,
  //     "token":"..."
  //     }
  // }

  // import Initializable from "../../Infrastructure/Initializable"
  class Article /* implements Initializable*/ {
      constructor(title, slug, body, createdAt, updatedAt, tagList, description, profile, favorited, favoritesCount) {
          this.title = title;
          this.slug = slug;
          this.body = body;
          this.createdAt = createdAt;
          this.updatedAt = updatedAt;
          this.tagList = tagList;
          this.description = description;
          this.author = profile;
          this.favorited = favorited;
          this.favoritesCount = favoritesCount;
      }
  }
  Article.init = (object) => {
      return new Article(object.title, object.slug, object.body, new Date(object.createdAt), new Date(object.updatedAt), object.tagList, object.description, object.author, object.favorited, object.favoritesCount);
  };

  // "comments": [
  //     {
  //         "id": 42546,
  //         "createdAt": "2019-07-13T23:42:57.417Z",
  //         "updatedAt": "2019-07-13T23:42:57.417Z",
  //         "body": "ok",
  //         "author": {
  //             "username": "ruslanguns2",
  //             "bio": null,
  //             "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
  //             "following": false
  //         }
  //     }
  // ]
  class Comment {
      constructor(id, createdAt, updatedAt, body, author) {
          this.id = id;
          this.createdAt = createdAt;
          this.updatedAt = updatedAt;
          this.body = body;
          this.author = author;
      }
  }
  Comment.init = (object) => {
      return new Comment(object.id, new Date(object.createdAt), new Date(object.updatedAt), object.body, object.author);
  };

  class ServerError {
      constructor(subject, objects) {
          this.concatObjects = () => {
              let concated = "";
              for (let index in this.objects) {
                  concated += this.objects[index];
                  if (Number(index) !== this.objects.length - 1) {
                      concated += ", ";
                  }
              }
              return concated;
          };
          this.subject = subject;
          this.objects = objects;
      }
  }

  class ArticleContainer {
      constructor(count, articles) {
          this.count = count;
          this.articles = articles;
      }
  }

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

  class ConduitProductionRepository {
      constructor() {
          this.endpoint = Settings.shared().valueForKey("endpoint");
          this.login = (email, password) => {
              return this.fetchingPromise("/users/login", "POST", this.headers(), { "user": { "email": email, "password": password } }).then(json => User.init(json.user));
          };
          this.register = (username, email, password) => {
              return this.fetchingPromise("/users", "POST", this.headers(), { "user": { "username": username, "email": email, "password": password } }).then(json => User.init(json.user));
          };
          this.getUser = (token) => {
              return this.fetchingPromise("/user", "GET", this.headers(token), null).then(json => User.init(json.user));
          };
          this.updateUser = (token, user) => {
              return this.fetchingPromise("/user", "PUT", this.headers(token), { "user": user.trimmed() }).then(json => User.init(json.user));
          };
          this.getArticles = (token, limit, offset) => {
              return this.getArticleContainer(this.buildPath("articles", this.buildArticlesQuery(limit, offset)), "GET", this.headers(token));
          };
          this.getArticlesOfAuthor = (username, token, limit, offset) => {
              return this.getArticleContainer(this.buildPath("articles", this.buildArticlesQuery(limit, offset, null, null, username)), "GET", this.headers(token));
          };
          this.getArticlesForFavoriteUser = (username, token, limit, offset) => {
              return this.getArticleContainer(this.buildPath("articles", this.buildArticlesQuery(limit, offset, null, username)), "GET", this.headers(token));
          };
          this.getArticlesOfTagged = (tag, token, limit, offset) => {
              return this.getArticleContainer(this.buildPath("articles", this.buildArticlesQuery(limit, offset, tag)), "GET", this.headers(token));
          };
          this.getArticlesByFollowingUser = (token, limit, offset) => {
              return this.getArticleContainer(this.buildPath("articles/feed", this.buildArticlesQuery(limit, offset)), "GET", this.headers(token));
          };
          this.getArticle = (slug, token) => {
              return this.fetchingPromise("/articles/" + slug, "GET", this.headers(token)).then(json => Article.init(json.article));
          };
          this.postArticle = (token, article) => {
              return this.fetchingPromise("/articles/", "POST", this.headers(token), { "article": article }).then(json => Article.init(json.article));
          };
          this.updateArticle = (token, article, slug) => {
              return this.fetchingPromise("/articles/" + slug, "PUT", this.headers(token), { "article": article }).then(json => Article.init(json.article));
          };
          this.deleteArticle = (token, slug) => {
              return this.fetchingPromise("/articles/" + slug, "DELETE", this.headers(token));
          };
          this.favorite = (token, slug) => {
              return this.fetchingPromise("/articles/" + slug + "/favorite", "POST", this.headers(token)).then(json => Article.init(json.article));
          };
          this.unfavorite = (token, slug) => {
              return this.fetchingPromise("/articles/" + slug + "/favorite", "DELETE", this.headers(token)).then(json => Article.init(json.article));
          };
          this.getComments = (slug) => {
              return this.fetchingPromise("/articles/" + slug + "/comments", "GET", this.headers()).then(json => json.comments.map(comment => Comment.init(comment)));
          };
          this.postComment = (token, slug, comment) => {
              return this.fetchingPromise("/articles/" + slug + "/comments", "POST", this.headers(token), { "comment": { "body": comment } }).then(json => Comment.init(json.comment));
          };
          this.deleteComment = (token, slug, commentId) => {
              return this.fetchingPromise("/articles/" + slug + "/comments/" + commentId, "DELETE", this.headers(token));
          };
          this.getProfile = (username, token) => {
              return this.fetchingPromise("/profiles/" + username, "GET", this.headers(token)).then(json => Profile.init(json.profile));
          };
          this.follow = (token, username) => {
              return this.fetchingPromise("/profiles/" + username + "/follow", "POST", this.headers(token)).then(json => Profile.init(json.profile));
          };
          this.unfollow = (token, username) => {
              return this.fetchingPromise("/profiles/" + username + "/follow", "DELETE", this.headers(token)).then(json => Profile.init(json.profile));
          };
          this.getTags = () => {
              return this.fetchingPromise("/tags", "GET", this.headers()).then(json => json.tags);
          };
          // Privates
          this.getArticleContainer = (path, method, headers) => {
              return this.fetchingPromise(path, method, headers).then(json => new ArticleContainer(json.articlesCount, json.articles));
          };
          this.headers = (token) => {
              let headers = {
                  "Accept": "application/json",
                  "Content-Type": "application/json"
              };
              if (token != null) {
                  headers["Authorization"] = "Token " + token;
              }
              return headers;
          };
          this.buildPath = (scene, queries) => {
              let path = scene;
              if (queries != null) {
                  let concated = "?";
                  Object.keys(queries).forEach((key, index, keys) => {
                      concated += key + "=" + queries[key];
                      if (index !== keys.length - 1) {
                          concated += "&";
                      }
                  });
                  if (concated.length > 0) {
                      path += concated;
                  }
              }
              return path;
          };
          this.buildArticlesQuery = (limit, offset, tag, favorited, author) => {
              if (tag == null && favorited == null && author == null && offset == null && limit == null) {
                  return null;
              }
              let queries = {};
              if (offset != null && offset > 0) {
                  queries["offset"] = offset.toString();
              }
              if (limit != null && limit > 0) {
                  queries["limit"] = limit.toString();
              }
              if (tag != null) {
                  queries["tag"] = tag;
              }
              else if (favorited != null) {
                  queries["favorited"] = favorited;
              }
              else if (author != null) {
                  queries["author"] = author;
              }
              return queries;
          };
          this.evaluateResponse = (response, successHandler, failureHandler) => __awaiter(this, void 0, void 0, function* () {
              if (response.status === 200) {
                  successHandler(yield response.json());
              }
              else if (response.status === 422) {
                  let json = yield response.json();
                  let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]));
                  failureHandler(errors.map((error) => new Error(error.subject + " " + error.concatObjects())));
              }
              else {
                  failureHandler(new Error("Unexpected error.　code=" + response.status));
              }
          });
          this.fetchingPromise = (path, method, headers, body) => {
              let init = { "method": method };
              if (headers != null) {
                  init["headers"] = headers;
              }
              if (body != null) {
                  init["body"] = JSON.stringify(body);
              }
              return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                  const response = yield fetch(this.endpoint + "/" + path, init);
                  this.evaluateResponse(response, json => { resolve(json); }, error => { reject(error); });
              }));
          };
      }
  }

  /**
   * The code was extracted from:
   * https://github.com/davidchambers/Base64.js
   */

  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }

  InvalidCharacterError.prototype = new Error();
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  function polyfill (input) {
    var str = String(input).replace(/=+$/, '');
    if (str.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = str.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  }


  var atob = typeof window !== 'undefined' && window.atob && window.atob.bind(window) || polyfill;

  function b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).replace(/(.)/g, function (m, p) {
      var code = p.charCodeAt(0).toString(16).toUpperCase();
      if (code.length < 2) {
        code = '0' + code;
      }
      return '%' + code;
    }));
  }

  var base64_url_decode = function(str) {
    var output = str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += "==";
        break;
      case 3:
        output += "=";
        break;
      default:
        throw "Illegal base64url string!";
    }

    try{
      return b64DecodeUnicode(output);
    } catch (err) {
      return atob(output);
    }
  };

  function InvalidTokenError(message) {
    this.message = message;
  }

  InvalidTokenError.prototype = new Error();
  InvalidTokenError.prototype.name = 'InvalidTokenError';

  var lib = function (token,options) {
    if (typeof token !== 'string') {
      throw new InvalidTokenError('Invalid token specified');
    }

    options = options || {};
    var pos = options.header === true ? 0 : 1;
    try {
      return JSON.parse(base64_url_decode(token.split('.')[pos]));
    } catch (e) {
      throw new InvalidTokenError('Invalid token specified: ' + e.message);
    }
  };

  var InvalidTokenError_1 = InvalidTokenError;
  lib.InvalidTokenError = InvalidTokenError_1;

  class UserLocalStorageRepository {
      constructor() {
          this.user = () => {
              let value = localStorage.getItem("user");
              if (value == null) {
                  return null;
              }
              const user = User.init(JSON.parse(value));
              // check expired
              let decoded = lib(user.token);
              let now = Date.now() / 1000; // mili sec
              let exp = Number(decoded["exp"]); // sec
              if (now > exp) {
                  this.setUser(null);
                  return null;
              }
              return user;
          };
          this.setUser = (user) => {
              if (user) {
                  // set
                  const string = JSON.stringify(user);
                  localStorage.setItem("user", string);
              }
              else {
                  // remove
                  localStorage.removeItem("user");
              }
          };
          this.isLoggedIn = () => {
              return this.user() != null;
          };
      }
  }

  class HTTPURL {
      constructor(scheme, host, path, query, port) {
          this.fullPath = () => {
              return this.scheme + "://" + this.hostAndPort() + "/" + this.path + "?" + this.concatedQuery();
          };
          this.debugDescription = () => {
              for (let key in this) {
                  let value = this[key];
                  switch (typeof value) {
                      case "object":
                          console.log(key + " = " + JSON.stringify(value));
                          break;
                      case "string":
                          console.log(key + " = " + value);
                          break;
                  }
              }
              console.log("fullPath = " + this.fullPath());
          };
          this.concatedQuery = () => {
              let concated = "";
              Object.keys(this.query).forEach((key, index, keys) => {
                  concated += key + "=" + this.query[key];
                  if (index !== keys.length - 1) {
                      concated += "&";
                  }
              });
              return concated;
          };
          this.hostAndPort = () => {
              if (this.port === null) {
                  return this.host;
              }
              else {
                  return this.host + ":" + this.port;
              }
          };
          this.scheme = scheme;
          this.host = host;
          this.path = path;
          this.query = query;
          this.port = port;
      }
  }

  /// Easliy HTTP(S) URL Parser for SPA. ftp, ssh, git and other is not supported ;)
  class HTTPURLParser {
      constructor() {
          this.parse = (urlString) => {
              try {
                  let scheme = this.parsedScheme(urlString);
                  let host = this.parsedHost(urlString);
                  let port = this.parsedPort(urlString);
                  let path = this.parsedPath(urlString);
                  let query = this.parsedQuery(urlString);
                  if (scheme == null || host == null || Number.isNaN(port) || (path === null && query !== null)) {
                      throw Error("urlString is not HTTPURL.");
                  }
                  // Success
                  return new HTTPURL(scheme, host, path, query, port);
              }
              catch (error) {
                  if (error instanceof Error) {
                      console.log(error.message);
                  }
                  // Failure
                  return null;
              }
          };
          this.parsedScheme = (urlString) => {
              // scheme
              const slasher = "://";
              let index = urlString.indexOf(slasher);
              if (index === -1) {
                  return null; // not url
              }
              return urlString.substr(0, index);
          };
          this.parsedHost = (urlString) => {
              return this.splitHostAndPort(this.parsedHostAndPort(urlString)).host;
          };
          this.parsedPort = (urlString) => {
              return this.splitHostAndPort(this.parsedHostAndPort(urlString)).port;
          };
          this.parsedPath = (urlString) => {
              const slasher = "://";
              let index = urlString.indexOf(slasher);
              if (index === -1) {
                  return null; // not url
              }
              let indexS = urlString.indexOf("/", index + slasher.length);
              if (indexS === -1) {
                  return null; // path is not found
              }
              // "?" terminate
              let indexQ = urlString.indexOf("?", indexS);
              if (indexQ !== -1) {
                  let path = urlString.substr(indexS + 1, indexQ - indexS - 1);
                  return path.length === 0 ? null : path;
              }
              // path only
              let path = urlString.substr(indexS + 1);
              return path.length === 0 ? null : path;
          };
          this.parsedQuery = (urlString) => {
              // query
              let indexQ = urlString.indexOf("?");
              let query = {};
              if (indexQ === -1) {
                  return null; // query not found
              }
              if (urlString.split("?").length !== 2) {
                  throw Error("Unexpected query.");
              }
              let queryString = urlString.split("?")[1];
              let keyValues = queryString.split("&");
              for (let i in keyValues) {
                  let keyValue = keyValues[i];
                  let arr = keyValue.split("=");
                  if (arr.length !== 2) {
                      throw Error("A query has unexpected key-value.");
                  }
                  query[arr[0]] = arr[1];
              }
              return query;
          };
          this.parsedHostAndPort = (urlString) => {
              // host
              const slasher = "://";
              let index = urlString.indexOf(slasher);
              let afterScheme = urlString.substr(index + slasher.length);
              // "/" terminate
              let indexS = afterScheme.indexOf("/");
              if (indexS !== -1) {
                  return afterScheme.substr(0, indexS);
              }
              // "?" terminate
              let indexQ = afterScheme.indexOf("?");
              if (indexQ !== -1) {
                  return afterScheme.substr(0, indexQ);
              }
              // host only
              return afterScheme;
          };
          this.splitHostAndPort = (hostWithPort) => {
              // port
              let indexC = hostWithPort.indexOf(":");
              if (indexC !== -1) {
                  let splitted = hostWithPort.split(":");
                  if (splitted.length === 2) {
                      return { host: splitted[0], port: Number(splitted[1]) };
                  }
                  throw Error("A host has multiple colon.");
              }
              return { host: hostWithPort, port: null };
          };
      }
  }

  /**
   * Location parser specialized in SPA.
   */
  class SPALocation {
      constructor() {
          this._scene = null;
          this._paths = null;
          this._query = null;
          this.scene = () => { return this._scene; };
          this.paths = () => { return this._paths; };
          this.query = () => { return this._query; };
          this.updateProperties = () => {
              try {
                  if (location.hash === null || location.hash.length === 0) {
                      throw Error("location is empty.");
                  }
                  let url = new HTTPURLParser().parse(location.href);
                  let path = url.path;
                  if (path === null) {
                      throw Error("A path is empty.");
                  }
                  let index = path.indexOf("#/");
                  if (index === -1) {
                      throw Error("hashbang is not found.");
                  }
                  let str = path.substr(index + 2).replace(/\/$/, "");
                  let splited = str.split("/");
                  if (splited.length < 1) {
                      throw Error("A path is not splittable.");
                  }
                  this._scene = splited.shift();
                  this._paths = splited.length > 0 ? splited : null;
                  this._query = url.query;
              }
              catch (error) {
                  this._scene = null;
                  this._paths = null;
                  this._query = null;
              }
          };
          if (SPALocation._instance) {
              throw new Error("You must use the shared().");
          }
          SPALocation._instance = this;
      }
  }
  SPALocation.shared = () => {
      if (SPALocation._instance === undefined) {
          SPALocation._instance = new SPALocation();
      }
      SPALocation._instance.updateProperties();
      return SPALocation._instance;
  };

  class SPAPathBuilder {
      constructor(scene, paths, query) {
          this.path = () => {
              return this.sceneString() + this.pathString() + this.keyValueStrings();
          };
          this.fullPath = () => {
              let url = new HTTPURLParser().parse(location.href);
              return url.scheme + "://" + this.hostAndPort(url.host, url.port) + (this.path() === "" ? "" : "/" + this.path());
          };
          this.hostAndPort = (host, port) => {
              if (port == null || port === 0) {
                  return host;
              }
              else {
                  return host + ":" + port;
              }
          };
          this.keyValueStrings = () => {
              if (this.query == null) {
                  return "";
              }
              return "?" + Object.entries(this.query)
                  .map((keyValue) => keyValue.join("="))
                  .join("&");
          };
          this.pathString = () => {
              if (this.paths == null) {
                  return "";
              }
              return "/" + this.paths.join("/");
          };
          this.sceneString = () => {
              if (this.scene == null) {
                  return "";
              }
              return "#/" + this.scene;
          };
          this.scene = scene;
          this.paths = paths;
          this.query = query;
      }
  }

  class ArticleTabItem {
      constructor(identifier, title, isActive) {
          this.identifier = identifier;
          this.title = title;
          this.isActive = isActive;
      }
  }

  class MenuItem {
      constructor(identifier, title, href, isActive, icon, image) {
          this.icon = null;
          this.image = null;
          this.identifier = identifier;
          this.title = title;
          this.isActive = isActive;
          this.href = href;
          this.icon = (icon !== undefined) ? icon : null;
          this.image = (image !== undefined) ? image : null;
      }
  }

  class MenuItemsBuilder {
      constructor() {
          this.items = (scene, user) => {
              if (user !== null) {
                  return [
                      new MenuItem("articles", "Home", "#/", (scene === "articles")),
                      new MenuItem("editer", "New Article", "#/editer", (scene === "editer"), "ion-compose"),
                      new MenuItem("settings", "Settings", "#/settings", (scene === "settings"), "ion-gear-a"),
                      new MenuItem("profile", user.username, "#/profile/" + user.username, (scene === "profile"), null, user.image)
                  ];
              }
              else {
                  return [
                      new MenuItem("articles", "Home", "#/", (scene === "articles")),
                      new MenuItem("login", "Sign In", "#/login", (scene === "login")),
                      new MenuItem("register", "Sign Up", "#/register", (scene === "register"))
                  ];
              }
          };
      }
  }

  class ArticlesUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this.container = null;
          this.requestArticles = () => {
              let limit = Settings.shared().valueForKey("countOfArticleInView");
              let offset = this.state.page == null ? null : (this.state.page - 1) * limit;
              let nextProcess = (c) => { this.container = c; return c; };
              let token = this.storage.user() === null ? null : this.storage.user().token;
              switch (this.state.kind) {
                  case "your":
                      return this.conduit.getArticlesByFollowingUser(token, limit, offset).then(nextProcess);
                  case "tag":
                      return this.conduit.getArticlesOfTagged(this.state.tag, token, limit, offset).then(nextProcess);
                  case "global":
                  default:
                      return this.conduit.getArticles(token, limit, offset).then(nextProcess);
              }
          };
          this.requestTags = () => {
              return this.conduit.getTags();
          };
          this.isLoggedIn = () => {
              return this.storage.isLoggedIn();
          };
          this.loggedUser = () => {
              return this.storage.user();
          };
          this.pageCount = () => {
              if (this.container == null || this.container.count === 0) {
                  return 0;
              }
              let limit = Settings.shared().valueForKey("countOfArticleInView");
              return Math.floor(this.container.count / limit);
          };
          this.currentPage = () => {
              return this.state.page;
          };
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.tabItems = () => {
              let tabs = [];
              // Add "Your feed" ?
              if (this.isLoggedIn()) {
                  tabs.push(new ArticleTabItem("your", "Your Feed", (this.state.kind === "your")));
              }
              // Add "Global feed"
              tabs.push(new ArticleTabItem("global", "Global Feed", (this.state.kind === "global")));
              // Add "# {tag}" ?
              if (this.state.kind === "tag") {
                  let tag = this.state.tag;
                  if (tag != null) {
                      tabs.push(new ArticleTabItem("tag", "# " + tag, true));
                  }
              }
              return tabs;
          };
          this.jumpPage = (page) => {
              let path = new SPAPathBuilder(this.state.scene, SPALocation.shared().paths(), { "page": String(page) }).fullPath();
              location.href = path;
          };
          this.jumpToSubPath = (path) => {
              let full = new SPAPathBuilder(this.state.scene, [path]).fullPath();
              location.href = full;
          };
          this.jumpToProfileScene = (profile) => {
              location.href = new SPAPathBuilder("profile", [profile.username]).fullPath();
          };
          this.jumpToArticleScene = (article) => {
              location.href = new SPAPathBuilder("article", [article.slug]).fullPath();
          };
          this.toggleFavorite = (article) => {
              if (article === null) {
                  throw Error("Article is empty.");
              }
              let user = this.storage.user();
              if (user === null) {
                  return new Promise((resolve, _) => __awaiter(this, void 0, void 0, function* () { resolve(null); }));
              }
              let process = (article) => {
                  let filtered = this.container.articles.filter(a => a.slug === article.slug)[0];
                  let index = this.container.articles.indexOf(filtered);
                  this.container.articles.splice(index, 1, article);
                  return this.container.articles;
              };
              switch (article.favorited) {
                  case true: return this.conduit.unfavorite(user.token, article.slug).then(process);
                  case false: return this.conduit.favorite(user.token, article.slug).then(process);
              }
          };
          this.state = new ArticlesState(SPALocation.shared());
      }
  }
  class ArticlesState {
      constructor(location) {
          // scene
          this.scene = location.scene() ? location.scene() : "articles";
          // kind
          let paths = location.paths() ? location.paths() : [];
          let kind = (paths.length >= 1) ? paths[0] : "global";
          this.kind = kind;
          // tag
          if (kind === "tag" && paths.length >= 2) {
              this.tag = paths[1];
          }
          // page
          switch (location.query()) {
              case undefined:
              case null:
                  this.page = 1;
                  break;
              default:
                  let page = location.query()["page"];
                  if (page === undefined || page == null) {
                      this.page = 1;
                  }
                  else {
                      this.page = Number(page);
                  }
          }
      }
  }

  riot$1.tag2('articles_view_controller', '<div class="home-page"> <header_view></header_view> <virtual if="{isLoggedIn() == false}"> <banner_view></banner_view> </virtual> <div class="container page"> <div class="row"> <div class="col-md-9"> <article_tab_view toggle_style="feed-toggle"></article_tab_view> <articles_table_view></articles_table_view> <pagenation_view></pagenation_view> </div> <div class="col-md-3"> <tags_view></tags_view> </div> </div> </div> <footer_view></footer_view> </div>', '', '', function(opts) {

  var self = this;
  var useCase = new ArticlesUseCase();

  this.on("mount", () => {

      self.tags.header_view.setItems( useCase.menuItems() );

      useCase.requestArticles().then( (container) => {
          self.tags.articles_table_view.setArticles( container.articles );

          self.tags.pagenation_view.shownPage = useCase.currentPage();
          self.tags.pagenation_view.setCountOfPage( useCase.pageCount() );
      });

      useCase.requestTags().then( (tags) => {
          self.tags.tags_view.setTagWords( tags );
          self.tags.tags_view.update();
      });

      self.tags.article_tab_view.setItems( useCase.tabItems() );

      self.tags.pagenation_view.didSelectPageNumber = (page) => {
          useCase.jumpPage(page);
      };
      self.tags.article_tab_view.didSelectTab = (item) => {
          useCase.jumpToSubPath(item.identifier);
      };
      self.tags.articles_table_view.didSelectArticle = (article) => {
          useCase.jumpToArticleScene(article);
      };
      self.tags.articles_table_view.didSelectProfile = (profile) => {
          useCase.jumpToProfileScene (profile);
      };

      if ( useCase.isLoggedIn() == false ){ return }

      self.tags.articles_table_view.didFavorite = (article) => {
          useCase.toggleFavorite(article).then( articles => {
              if ( articles === null ) return
              self.tags.articles_table_view.setArticles( articles );
          });
      };
  });

  self.isLoggedIn = () => {
      return useCase.isLoggedIn()
  };

  });

  class LoginUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this.login = (email, password) => __awaiter(this, void 0, void 0, function* () {
              return this.conduit.login(email, password).then((user) => {
                  this.storage.setUser(user);
              });
          });
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.state = new LoginState(SPALocation.shared());
      }
  }
  class LoginState {
      constructor(location) {
          // scene
          this.scene = location.scene();
      }
  }

  riot$1.tag2('login_view_controller', '<header_view></header_view> <div class="auth-page"> <div class="container page"> <div class="row"> <div class="col-md-6 offset-md-3 col-xs-12"> <h1 class="text-xs-center">Sign In</h1> <p class="text-xs-center"> <a href="#/register">Need an account?</a> </p> <ul if="{errors != null}" class="error-messages"> <li each="{error in errors}">{error}</li> </ul> <fieldset class="form-group"> <input ref="emailField" class="form-control form-control-lg" type="text" placeholder="Email" oninput="{shouldSubmit}"> </fieldset> <fieldset class="form-group"> <input ref="passwordField" class="form-control form-control-lg" type="password" placeholder="Password" oninput="{shouldSubmit}"> </fieldset> <button ref="submitButton" class="btn btn-lg btn-primary pull-xs-right" onclick="{actionOfSubmitButton}" disabled> Sign in </button> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new LoginUseCase();
  self.errors = null;

  self.on("mount", () => {

      self.tags.header_view.setItems( useCase.menuItems() );
  });

  self.actionOfSubmitButton = ( event ) => {
      useCase.login( self.refs.emailField.value, self.refs.passwordField.value ).then( () => {

          window.location.href = "/";
      }).catch( (error) => {

          if (error instanceof Array ) {
              self.errors = error.map( (aError) => aError.message );
          }else if( error instanceof Error ) {
              self.errors = [ error.message ];
          }
          self.update();
      });
  };

  self.shouldSubmit = ( event ) => {
      self.refs.submitButton.disabled = ( self.refs.emailField.value.length == 0 || self.refs.passwordField.value.length == 0 );
  };

  });

  var moment = createCommonjsModule(function (module, exports) {
  (function (global, factory) {
       module.exports = factory() ;
  }(commonjsGlobal, (function () {
      var hookCallback;

      function hooks () {
          return hookCallback.apply(null, arguments);
      }

      // This is done to register the method called with moment()
      // without creating circular dependencies.
      function setHookCallback (callback) {
          hookCallback = callback;
      }

      function isArray(input) {
          return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
      }

      function isObject(input) {
          // IE8 will treat undefined and null as object if it wasn't for
          // input != null
          return input != null && Object.prototype.toString.call(input) === '[object Object]';
      }

      function isObjectEmpty(obj) {
          if (Object.getOwnPropertyNames) {
              return (Object.getOwnPropertyNames(obj).length === 0);
          } else {
              var k;
              for (k in obj) {
                  if (obj.hasOwnProperty(k)) {
                      return false;
                  }
              }
              return true;
          }
      }

      function isUndefined(input) {
          return input === void 0;
      }

      function isNumber(input) {
          return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
      }

      function isDate(input) {
          return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
      }

      function map(arr, fn) {
          var res = [], i;
          for (i = 0; i < arr.length; ++i) {
              res.push(fn(arr[i], i));
          }
          return res;
      }

      function hasOwnProp(a, b) {
          return Object.prototype.hasOwnProperty.call(a, b);
      }

      function extend(a, b) {
          for (var i in b) {
              if (hasOwnProp(b, i)) {
                  a[i] = b[i];
              }
          }

          if (hasOwnProp(b, 'toString')) {
              a.toString = b.toString;
          }

          if (hasOwnProp(b, 'valueOf')) {
              a.valueOf = b.valueOf;
          }

          return a;
      }

      function createUTC (input, format, locale, strict) {
          return createLocalOrUTC(input, format, locale, strict, true).utc();
      }

      function defaultParsingFlags() {
          // We need to deep clone this object.
          return {
              empty           : false,
              unusedTokens    : [],
              unusedInput     : [],
              overflow        : -2,
              charsLeftOver   : 0,
              nullInput       : false,
              invalidMonth    : null,
              invalidFormat   : false,
              userInvalidated : false,
              iso             : false,
              parsedDateParts : [],
              meridiem        : null,
              rfc2822         : false,
              weekdayMismatch : false
          };
      }

      function getParsingFlags(m) {
          if (m._pf == null) {
              m._pf = defaultParsingFlags();
          }
          return m._pf;
      }

      var some;
      if (Array.prototype.some) {
          some = Array.prototype.some;
      } else {
          some = function (fun) {
              var t = Object(this);
              var len = t.length >>> 0;

              for (var i = 0; i < len; i++) {
                  if (i in t && fun.call(this, t[i], i, t)) {
                      return true;
                  }
              }

              return false;
          };
      }

      function isValid(m) {
          if (m._isValid == null) {
              var flags = getParsingFlags(m);
              var parsedParts = some.call(flags.parsedDateParts, function (i) {
                  return i != null;
              });
              var isNowValid = !isNaN(m._d.getTime()) &&
                  flags.overflow < 0 &&
                  !flags.empty &&
                  !flags.invalidMonth &&
                  !flags.invalidWeekday &&
                  !flags.weekdayMismatch &&
                  !flags.nullInput &&
                  !flags.invalidFormat &&
                  !flags.userInvalidated &&
                  (!flags.meridiem || (flags.meridiem && parsedParts));

              if (m._strict) {
                  isNowValid = isNowValid &&
                      flags.charsLeftOver === 0 &&
                      flags.unusedTokens.length === 0 &&
                      flags.bigHour === undefined;
              }

              if (Object.isFrozen == null || !Object.isFrozen(m)) {
                  m._isValid = isNowValid;
              }
              else {
                  return isNowValid;
              }
          }
          return m._isValid;
      }

      function createInvalid (flags) {
          var m = createUTC(NaN);
          if (flags != null) {
              extend(getParsingFlags(m), flags);
          }
          else {
              getParsingFlags(m).userInvalidated = true;
          }

          return m;
      }

      // Plugins that add properties should also add the key here (null value),
      // so we can properly clone ourselves.
      var momentProperties = hooks.momentProperties = [];

      function copyConfig(to, from) {
          var i, prop, val;

          if (!isUndefined(from._isAMomentObject)) {
              to._isAMomentObject = from._isAMomentObject;
          }
          if (!isUndefined(from._i)) {
              to._i = from._i;
          }
          if (!isUndefined(from._f)) {
              to._f = from._f;
          }
          if (!isUndefined(from._l)) {
              to._l = from._l;
          }
          if (!isUndefined(from._strict)) {
              to._strict = from._strict;
          }
          if (!isUndefined(from._tzm)) {
              to._tzm = from._tzm;
          }
          if (!isUndefined(from._isUTC)) {
              to._isUTC = from._isUTC;
          }
          if (!isUndefined(from._offset)) {
              to._offset = from._offset;
          }
          if (!isUndefined(from._pf)) {
              to._pf = getParsingFlags(from);
          }
          if (!isUndefined(from._locale)) {
              to._locale = from._locale;
          }

          if (momentProperties.length > 0) {
              for (i = 0; i < momentProperties.length; i++) {
                  prop = momentProperties[i];
                  val = from[prop];
                  if (!isUndefined(val)) {
                      to[prop] = val;
                  }
              }
          }

          return to;
      }

      var updateInProgress = false;

      // Moment prototype object
      function Moment(config) {
          copyConfig(this, config);
          this._d = new Date(config._d != null ? config._d.getTime() : NaN);
          if (!this.isValid()) {
              this._d = new Date(NaN);
          }
          // Prevent infinite loop in case updateOffset creates new moment
          // objects.
          if (updateInProgress === false) {
              updateInProgress = true;
              hooks.updateOffset(this);
              updateInProgress = false;
          }
      }

      function isMoment (obj) {
          return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
      }

      function absFloor (number) {
          if (number < 0) {
              // -0 -> 0
              return Math.ceil(number) || 0;
          } else {
              return Math.floor(number);
          }
      }

      function toInt(argumentForCoercion) {
          var coercedNumber = +argumentForCoercion,
              value = 0;

          if (coercedNumber !== 0 && isFinite(coercedNumber)) {
              value = absFloor(coercedNumber);
          }

          return value;
      }

      // compare two arrays, return the number of differences
      function compareArrays(array1, array2, dontConvert) {
          var len = Math.min(array1.length, array2.length),
              lengthDiff = Math.abs(array1.length - array2.length),
              diffs = 0,
              i;
          for (i = 0; i < len; i++) {
              if ((dontConvert && array1[i] !== array2[i]) ||
                  (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                  diffs++;
              }
          }
          return diffs + lengthDiff;
      }

      function warn(msg) {
          if (hooks.suppressDeprecationWarnings === false &&
                  (typeof console !==  'undefined') && console.warn) {
              console.warn('Deprecation warning: ' + msg);
          }
      }

      function deprecate(msg, fn) {
          var firstTime = true;

          return extend(function () {
              if (hooks.deprecationHandler != null) {
                  hooks.deprecationHandler(null, msg);
              }
              if (firstTime) {
                  var args = [];
                  var arg;
                  for (var i = 0; i < arguments.length; i++) {
                      arg = '';
                      if (typeof arguments[i] === 'object') {
                          arg += '\n[' + i + '] ';
                          for (var key in arguments[0]) {
                              arg += key + ': ' + arguments[0][key] + ', ';
                          }
                          arg = arg.slice(0, -2); // Remove trailing comma and space
                      } else {
                          arg = arguments[i];
                      }
                      args.push(arg);
                  }
                  warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                  firstTime = false;
              }
              return fn.apply(this, arguments);
          }, fn);
      }

      var deprecations = {};

      function deprecateSimple(name, msg) {
          if (hooks.deprecationHandler != null) {
              hooks.deprecationHandler(name, msg);
          }
          if (!deprecations[name]) {
              warn(msg);
              deprecations[name] = true;
          }
      }

      hooks.suppressDeprecationWarnings = false;
      hooks.deprecationHandler = null;

      function isFunction(input) {
          return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
      }

      function set (config) {
          var prop, i;
          for (i in config) {
              prop = config[i];
              if (isFunction(prop)) {
                  this[i] = prop;
              } else {
                  this['_' + i] = prop;
              }
          }
          this._config = config;
          // Lenient ordinal parsing accepts just a number in addition to
          // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
          // TODO: Remove "ordinalParse" fallback in next major release.
          this._dayOfMonthOrdinalParseLenient = new RegExp(
              (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                  '|' + (/\d{1,2}/).source);
      }

      function mergeConfigs(parentConfig, childConfig) {
          var res = extend({}, parentConfig), prop;
          for (prop in childConfig) {
              if (hasOwnProp(childConfig, prop)) {
                  if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                      res[prop] = {};
                      extend(res[prop], parentConfig[prop]);
                      extend(res[prop], childConfig[prop]);
                  } else if (childConfig[prop] != null) {
                      res[prop] = childConfig[prop];
                  } else {
                      delete res[prop];
                  }
              }
          }
          for (prop in parentConfig) {
              if (hasOwnProp(parentConfig, prop) &&
                      !hasOwnProp(childConfig, prop) &&
                      isObject(parentConfig[prop])) {
                  // make sure changes to properties don't modify parent config
                  res[prop] = extend({}, res[prop]);
              }
          }
          return res;
      }

      function Locale(config) {
          if (config != null) {
              this.set(config);
          }
      }

      var keys;

      if (Object.keys) {
          keys = Object.keys;
      } else {
          keys = function (obj) {
              var i, res = [];
              for (i in obj) {
                  if (hasOwnProp(obj, i)) {
                      res.push(i);
                  }
              }
              return res;
          };
      }

      var defaultCalendar = {
          sameDay : '[Today at] LT',
          nextDay : '[Tomorrow at] LT',
          nextWeek : 'dddd [at] LT',
          lastDay : '[Yesterday at] LT',
          lastWeek : '[Last] dddd [at] LT',
          sameElse : 'L'
      };

      function calendar (key, mom, now) {
          var output = this._calendar[key] || this._calendar['sameElse'];
          return isFunction(output) ? output.call(mom, now) : output;
      }

      var defaultLongDateFormat = {
          LTS  : 'h:mm:ss A',
          LT   : 'h:mm A',
          L    : 'MM/DD/YYYY',
          LL   : 'MMMM D, YYYY',
          LLL  : 'MMMM D, YYYY h:mm A',
          LLLL : 'dddd, MMMM D, YYYY h:mm A'
      };

      function longDateFormat (key) {
          var format = this._longDateFormat[key],
              formatUpper = this._longDateFormat[key.toUpperCase()];

          if (format || !formatUpper) {
              return format;
          }

          this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
              return val.slice(1);
          });

          return this._longDateFormat[key];
      }

      var defaultInvalidDate = 'Invalid date';

      function invalidDate () {
          return this._invalidDate;
      }

      var defaultOrdinal = '%d';
      var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

      function ordinal (number) {
          return this._ordinal.replace('%d', number);
      }

      var defaultRelativeTime = {
          future : 'in %s',
          past   : '%s ago',
          s  : 'a few seconds',
          ss : '%d seconds',
          m  : 'a minute',
          mm : '%d minutes',
          h  : 'an hour',
          hh : '%d hours',
          d  : 'a day',
          dd : '%d days',
          M  : 'a month',
          MM : '%d months',
          y  : 'a year',
          yy : '%d years'
      };

      function relativeTime (number, withoutSuffix, string, isFuture) {
          var output = this._relativeTime[string];
          return (isFunction(output)) ?
              output(number, withoutSuffix, string, isFuture) :
              output.replace(/%d/i, number);
      }

      function pastFuture (diff, output) {
          var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
          return isFunction(format) ? format(output) : format.replace(/%s/i, output);
      }

      var aliases = {};

      function addUnitAlias (unit, shorthand) {
          var lowerCase = unit.toLowerCase();
          aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
      }

      function normalizeUnits(units) {
          return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
      }

      function normalizeObjectUnits(inputObject) {
          var normalizedInput = {},
              normalizedProp,
              prop;

          for (prop in inputObject) {
              if (hasOwnProp(inputObject, prop)) {
                  normalizedProp = normalizeUnits(prop);
                  if (normalizedProp) {
                      normalizedInput[normalizedProp] = inputObject[prop];
                  }
              }
          }

          return normalizedInput;
      }

      var priorities = {};

      function addUnitPriority(unit, priority) {
          priorities[unit] = priority;
      }

      function getPrioritizedUnits(unitsObj) {
          var units = [];
          for (var u in unitsObj) {
              units.push({unit: u, priority: priorities[u]});
          }
          units.sort(function (a, b) {
              return a.priority - b.priority;
          });
          return units;
      }

      function zeroFill(number, targetLength, forceSign) {
          var absNumber = '' + Math.abs(number),
              zerosToFill = targetLength - absNumber.length,
              sign = number >= 0;
          return (sign ? (forceSign ? '+' : '') : '-') +
              Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
      }

      var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

      var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

      var formatFunctions = {};

      var formatTokenFunctions = {};

      // token:    'M'
      // padded:   ['MM', 2]
      // ordinal:  'Mo'
      // callback: function () { this.month() + 1 }
      function addFormatToken (token, padded, ordinal, callback) {
          var func = callback;
          if (typeof callback === 'string') {
              func = function () {
                  return this[callback]();
              };
          }
          if (token) {
              formatTokenFunctions[token] = func;
          }
          if (padded) {
              formatTokenFunctions[padded[0]] = function () {
                  return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
              };
          }
          if (ordinal) {
              formatTokenFunctions[ordinal] = function () {
                  return this.localeData().ordinal(func.apply(this, arguments), token);
              };
          }
      }

      function removeFormattingTokens(input) {
          if (input.match(/\[[\s\S]/)) {
              return input.replace(/^\[|\]$/g, '');
          }
          return input.replace(/\\/g, '');
      }

      function makeFormatFunction(format) {
          var array = format.match(formattingTokens), i, length;

          for (i = 0, length = array.length; i < length; i++) {
              if (formatTokenFunctions[array[i]]) {
                  array[i] = formatTokenFunctions[array[i]];
              } else {
                  array[i] = removeFormattingTokens(array[i]);
              }
          }

          return function (mom) {
              var output = '', i;
              for (i = 0; i < length; i++) {
                  output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
              }
              return output;
          };
      }

      // format date using native date object
      function formatMoment(m, format) {
          if (!m.isValid()) {
              return m.localeData().invalidDate();
          }

          format = expandFormat(format, m.localeData());
          formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

          return formatFunctions[format](m);
      }

      function expandFormat(format, locale) {
          var i = 5;

          function replaceLongDateFormatTokens(input) {
              return locale.longDateFormat(input) || input;
          }

          localFormattingTokens.lastIndex = 0;
          while (i >= 0 && localFormattingTokens.test(format)) {
              format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
              localFormattingTokens.lastIndex = 0;
              i -= 1;
          }

          return format;
      }

      var match1         = /\d/;            //       0 - 9
      var match2         = /\d\d/;          //      00 - 99
      var match3         = /\d{3}/;         //     000 - 999
      var match4         = /\d{4}/;         //    0000 - 9999
      var match6         = /[+-]?\d{6}/;    // -999999 - 999999
      var match1to2      = /\d\d?/;         //       0 - 99
      var match3to4      = /\d\d\d\d?/;     //     999 - 9999
      var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
      var match1to3      = /\d{1,3}/;       //       0 - 999
      var match1to4      = /\d{1,4}/;       //       0 - 9999
      var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

      var matchUnsigned  = /\d+/;           //       0 - inf
      var matchSigned    = /[+-]?\d+/;      //    -inf - inf

      var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
      var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

      var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

      // any word (or two) characters or numbers including two/three word month in arabic.
      // includes scottish gaelic two word and hyphenated months
      var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

      var regexes = {};

      function addRegexToken (token, regex, strictRegex) {
          regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
              return (isStrict && strictRegex) ? strictRegex : regex;
          };
      }

      function getParseRegexForToken (token, config) {
          if (!hasOwnProp(regexes, token)) {
              return new RegExp(unescapeFormat(token));
          }

          return regexes[token](config._strict, config._locale);
      }

      // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
      function unescapeFormat(s) {
          return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
              return p1 || p2 || p3 || p4;
          }));
      }

      function regexEscape(s) {
          return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      }

      var tokens = {};

      function addParseToken (token, callback) {
          var i, func = callback;
          if (typeof token === 'string') {
              token = [token];
          }
          if (isNumber(callback)) {
              func = function (input, array) {
                  array[callback] = toInt(input);
              };
          }
          for (i = 0; i < token.length; i++) {
              tokens[token[i]] = func;
          }
      }

      function addWeekParseToken (token, callback) {
          addParseToken(token, function (input, array, config, token) {
              config._w = config._w || {};
              callback(input, config._w, config, token);
          });
      }

      function addTimeToArrayFromToken(token, input, config) {
          if (input != null && hasOwnProp(tokens, token)) {
              tokens[token](input, config._a, config, token);
          }
      }

      var YEAR = 0;
      var MONTH = 1;
      var DATE = 2;
      var HOUR = 3;
      var MINUTE = 4;
      var SECOND = 5;
      var MILLISECOND = 6;
      var WEEK = 7;
      var WEEKDAY = 8;

      // FORMATTING

      addFormatToken('Y', 0, 0, function () {
          var y = this.year();
          return y <= 9999 ? '' + y : '+' + y;
      });

      addFormatToken(0, ['YY', 2], 0, function () {
          return this.year() % 100;
      });

      addFormatToken(0, ['YYYY',   4],       0, 'year');
      addFormatToken(0, ['YYYYY',  5],       0, 'year');
      addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

      // ALIASES

      addUnitAlias('year', 'y');

      // PRIORITIES

      addUnitPriority('year', 1);

      // PARSING

      addRegexToken('Y',      matchSigned);
      addRegexToken('YY',     match1to2, match2);
      addRegexToken('YYYY',   match1to4, match4);
      addRegexToken('YYYYY',  match1to6, match6);
      addRegexToken('YYYYYY', match1to6, match6);

      addParseToken(['YYYYY', 'YYYYYY'], YEAR);
      addParseToken('YYYY', function (input, array) {
          array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
      });
      addParseToken('YY', function (input, array) {
          array[YEAR] = hooks.parseTwoDigitYear(input);
      });
      addParseToken('Y', function (input, array) {
          array[YEAR] = parseInt(input, 10);
      });

      // HELPERS

      function daysInYear(year) {
          return isLeapYear(year) ? 366 : 365;
      }

      function isLeapYear(year) {
          return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      }

      // HOOKS

      hooks.parseTwoDigitYear = function (input) {
          return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
      };

      // MOMENTS

      var getSetYear = makeGetSet('FullYear', true);

      function getIsLeapYear () {
          return isLeapYear(this.year());
      }

      function makeGetSet (unit, keepTime) {
          return function (value) {
              if (value != null) {
                  set$1(this, unit, value);
                  hooks.updateOffset(this, keepTime);
                  return this;
              } else {
                  return get(this, unit);
              }
          };
      }

      function get (mom, unit) {
          return mom.isValid() ?
              mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
      }

      function set$1 (mom, unit, value) {
          if (mom.isValid() && !isNaN(value)) {
              if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                  mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
              }
              else {
                  mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
              }
          }
      }

      // MOMENTS

      function stringGet (units) {
          units = normalizeUnits(units);
          if (isFunction(this[units])) {
              return this[units]();
          }
          return this;
      }


      function stringSet (units, value) {
          if (typeof units === 'object') {
              units = normalizeObjectUnits(units);
              var prioritized = getPrioritizedUnits(units);
              for (var i = 0; i < prioritized.length; i++) {
                  this[prioritized[i].unit](units[prioritized[i].unit]);
              }
          } else {
              units = normalizeUnits(units);
              if (isFunction(this[units])) {
                  return this[units](value);
              }
          }
          return this;
      }

      function mod(n, x) {
          return ((n % x) + x) % x;
      }

      var indexOf;

      if (Array.prototype.indexOf) {
          indexOf = Array.prototype.indexOf;
      } else {
          indexOf = function (o) {
              // I know
              var i;
              for (i = 0; i < this.length; ++i) {
                  if (this[i] === o) {
                      return i;
                  }
              }
              return -1;
          };
      }

      function daysInMonth(year, month) {
          if (isNaN(year) || isNaN(month)) {
              return NaN;
          }
          var modMonth = mod(month, 12);
          year += (month - modMonth) / 12;
          return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
      }

      // FORMATTING

      addFormatToken('M', ['MM', 2], 'Mo', function () {
          return this.month() + 1;
      });

      addFormatToken('MMM', 0, 0, function (format) {
          return this.localeData().monthsShort(this, format);
      });

      addFormatToken('MMMM', 0, 0, function (format) {
          return this.localeData().months(this, format);
      });

      // ALIASES

      addUnitAlias('month', 'M');

      // PRIORITY

      addUnitPriority('month', 8);

      // PARSING

      addRegexToken('M',    match1to2);
      addRegexToken('MM',   match1to2, match2);
      addRegexToken('MMM',  function (isStrict, locale) {
          return locale.monthsShortRegex(isStrict);
      });
      addRegexToken('MMMM', function (isStrict, locale) {
          return locale.monthsRegex(isStrict);
      });

      addParseToken(['M', 'MM'], function (input, array) {
          array[MONTH] = toInt(input) - 1;
      });

      addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
          var month = config._locale.monthsParse(input, token, config._strict);
          // if we didn't find a month name, mark the date as invalid.
          if (month != null) {
              array[MONTH] = month;
          } else {
              getParsingFlags(config).invalidMonth = input;
          }
      });

      // LOCALES

      var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
      var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
      function localeMonths (m, format) {
          if (!m) {
              return isArray(this._months) ? this._months :
                  this._months['standalone'];
          }
          return isArray(this._months) ? this._months[m.month()] :
              this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
      }

      var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
      function localeMonthsShort (m, format) {
          if (!m) {
              return isArray(this._monthsShort) ? this._monthsShort :
                  this._monthsShort['standalone'];
          }
          return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
              this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
      }

      function handleStrictParse(monthName, format, strict) {
          var i, ii, mom, llc = monthName.toLocaleLowerCase();
          if (!this._monthsParse) {
              // this is not used
              this._monthsParse = [];
              this._longMonthsParse = [];
              this._shortMonthsParse = [];
              for (i = 0; i < 12; ++i) {
                  mom = createUTC([2000, i]);
                  this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                  this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
              }
          }

          if (strict) {
              if (format === 'MMM') {
                  ii = indexOf.call(this._shortMonthsParse, llc);
                  return ii !== -1 ? ii : null;
              } else {
                  ii = indexOf.call(this._longMonthsParse, llc);
                  return ii !== -1 ? ii : null;
              }
          } else {
              if (format === 'MMM') {
                  ii = indexOf.call(this._shortMonthsParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._longMonthsParse, llc);
                  return ii !== -1 ? ii : null;
              } else {
                  ii = indexOf.call(this._longMonthsParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._shortMonthsParse, llc);
                  return ii !== -1 ? ii : null;
              }
          }
      }

      function localeMonthsParse (monthName, format, strict) {
          var i, mom, regex;

          if (this._monthsParseExact) {
              return handleStrictParse.call(this, monthName, format, strict);
          }

          if (!this._monthsParse) {
              this._monthsParse = [];
              this._longMonthsParse = [];
              this._shortMonthsParse = [];
          }

          // TODO: add sorting
          // Sorting makes sure if one month (or abbr) is a prefix of another
          // see sorting in computeMonthsParse
          for (i = 0; i < 12; i++) {
              // make the regex if we don't have it already
              mom = createUTC([2000, i]);
              if (strict && !this._longMonthsParse[i]) {
                  this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                  this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
              }
              if (!strict && !this._monthsParse[i]) {
                  regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                  this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
              }
              // test the regex
              if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                  return i;
              } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                  return i;
              } else if (!strict && this._monthsParse[i].test(monthName)) {
                  return i;
              }
          }
      }

      // MOMENTS

      function setMonth (mom, value) {
          var dayOfMonth;

          if (!mom.isValid()) {
              // No op
              return mom;
          }

          if (typeof value === 'string') {
              if (/^\d+$/.test(value)) {
                  value = toInt(value);
              } else {
                  value = mom.localeData().monthsParse(value);
                  // TODO: Another silent failure?
                  if (!isNumber(value)) {
                      return mom;
                  }
              }
          }

          dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
          mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
          return mom;
      }

      function getSetMonth (value) {
          if (value != null) {
              setMonth(this, value);
              hooks.updateOffset(this, true);
              return this;
          } else {
              return get(this, 'Month');
          }
      }

      function getDaysInMonth () {
          return daysInMonth(this.year(), this.month());
      }

      var defaultMonthsShortRegex = matchWord;
      function monthsShortRegex (isStrict) {
          if (this._monthsParseExact) {
              if (!hasOwnProp(this, '_monthsRegex')) {
                  computeMonthsParse.call(this);
              }
              if (isStrict) {
                  return this._monthsShortStrictRegex;
              } else {
                  return this._monthsShortRegex;
              }
          } else {
              if (!hasOwnProp(this, '_monthsShortRegex')) {
                  this._monthsShortRegex = defaultMonthsShortRegex;
              }
              return this._monthsShortStrictRegex && isStrict ?
                  this._monthsShortStrictRegex : this._monthsShortRegex;
          }
      }

      var defaultMonthsRegex = matchWord;
      function monthsRegex (isStrict) {
          if (this._monthsParseExact) {
              if (!hasOwnProp(this, '_monthsRegex')) {
                  computeMonthsParse.call(this);
              }
              if (isStrict) {
                  return this._monthsStrictRegex;
              } else {
                  return this._monthsRegex;
              }
          } else {
              if (!hasOwnProp(this, '_monthsRegex')) {
                  this._monthsRegex = defaultMonthsRegex;
              }
              return this._monthsStrictRegex && isStrict ?
                  this._monthsStrictRegex : this._monthsRegex;
          }
      }

      function computeMonthsParse () {
          function cmpLenRev(a, b) {
              return b.length - a.length;
          }

          var shortPieces = [], longPieces = [], mixedPieces = [],
              i, mom;
          for (i = 0; i < 12; i++) {
              // make the regex if we don't have it already
              mom = createUTC([2000, i]);
              shortPieces.push(this.monthsShort(mom, ''));
              longPieces.push(this.months(mom, ''));
              mixedPieces.push(this.months(mom, ''));
              mixedPieces.push(this.monthsShort(mom, ''));
          }
          // Sorting makes sure if one month (or abbr) is a prefix of another it
          // will match the longer piece.
          shortPieces.sort(cmpLenRev);
          longPieces.sort(cmpLenRev);
          mixedPieces.sort(cmpLenRev);
          for (i = 0; i < 12; i++) {
              shortPieces[i] = regexEscape(shortPieces[i]);
              longPieces[i] = regexEscape(longPieces[i]);
          }
          for (i = 0; i < 24; i++) {
              mixedPieces[i] = regexEscape(mixedPieces[i]);
          }

          this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
          this._monthsShortRegex = this._monthsRegex;
          this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
          this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
      }

      function createDate (y, m, d, h, M, s, ms) {
          // can't just apply() to create a date:
          // https://stackoverflow.com/q/181348
          var date;
          // the date constructor remaps years 0-99 to 1900-1999
          if (y < 100 && y >= 0) {
              // preserve leap years using a full 400 year cycle, then reset
              date = new Date(y + 400, m, d, h, M, s, ms);
              if (isFinite(date.getFullYear())) {
                  date.setFullYear(y);
              }
          } else {
              date = new Date(y, m, d, h, M, s, ms);
          }

          return date;
      }

      function createUTCDate (y) {
          var date;
          // the Date.UTC function remaps years 0-99 to 1900-1999
          if (y < 100 && y >= 0) {
              var args = Array.prototype.slice.call(arguments);
              // preserve leap years using a full 400 year cycle, then reset
              args[0] = y + 400;
              date = new Date(Date.UTC.apply(null, args));
              if (isFinite(date.getUTCFullYear())) {
                  date.setUTCFullYear(y);
              }
          } else {
              date = new Date(Date.UTC.apply(null, arguments));
          }

          return date;
      }

      // start-of-first-week - start-of-year
      function firstWeekOffset(year, dow, doy) {
          var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
              fwd = 7 + dow - doy,
              // first-week day local weekday -- which local weekday is fwd
              fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

          return -fwdlw + fwd - 1;
      }

      // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
      function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
          var localWeekday = (7 + weekday - dow) % 7,
              weekOffset = firstWeekOffset(year, dow, doy),
              dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
              resYear, resDayOfYear;

          if (dayOfYear <= 0) {
              resYear = year - 1;
              resDayOfYear = daysInYear(resYear) + dayOfYear;
          } else if (dayOfYear > daysInYear(year)) {
              resYear = year + 1;
              resDayOfYear = dayOfYear - daysInYear(year);
          } else {
              resYear = year;
              resDayOfYear = dayOfYear;
          }

          return {
              year: resYear,
              dayOfYear: resDayOfYear
          };
      }

      function weekOfYear(mom, dow, doy) {
          var weekOffset = firstWeekOffset(mom.year(), dow, doy),
              week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
              resWeek, resYear;

          if (week < 1) {
              resYear = mom.year() - 1;
              resWeek = week + weeksInYear(resYear, dow, doy);
          } else if (week > weeksInYear(mom.year(), dow, doy)) {
              resWeek = week - weeksInYear(mom.year(), dow, doy);
              resYear = mom.year() + 1;
          } else {
              resYear = mom.year();
              resWeek = week;
          }

          return {
              week: resWeek,
              year: resYear
          };
      }

      function weeksInYear(year, dow, doy) {
          var weekOffset = firstWeekOffset(year, dow, doy),
              weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
          return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
      }

      // FORMATTING

      addFormatToken('w', ['ww', 2], 'wo', 'week');
      addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

      // ALIASES

      addUnitAlias('week', 'w');
      addUnitAlias('isoWeek', 'W');

      // PRIORITIES

      addUnitPriority('week', 5);
      addUnitPriority('isoWeek', 5);

      // PARSING

      addRegexToken('w',  match1to2);
      addRegexToken('ww', match1to2, match2);
      addRegexToken('W',  match1to2);
      addRegexToken('WW', match1to2, match2);

      addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
          week[token.substr(0, 1)] = toInt(input);
      });

      // HELPERS

      // LOCALES

      function localeWeek (mom) {
          return weekOfYear(mom, this._week.dow, this._week.doy).week;
      }

      var defaultLocaleWeek = {
          dow : 0, // Sunday is the first day of the week.
          doy : 6  // The week that contains Jan 6th is the first week of the year.
      };

      function localeFirstDayOfWeek () {
          return this._week.dow;
      }

      function localeFirstDayOfYear () {
          return this._week.doy;
      }

      // MOMENTS

      function getSetWeek (input) {
          var week = this.localeData().week(this);
          return input == null ? week : this.add((input - week) * 7, 'd');
      }

      function getSetISOWeek (input) {
          var week = weekOfYear(this, 1, 4).week;
          return input == null ? week : this.add((input - week) * 7, 'd');
      }

      // FORMATTING

      addFormatToken('d', 0, 'do', 'day');

      addFormatToken('dd', 0, 0, function (format) {
          return this.localeData().weekdaysMin(this, format);
      });

      addFormatToken('ddd', 0, 0, function (format) {
          return this.localeData().weekdaysShort(this, format);
      });

      addFormatToken('dddd', 0, 0, function (format) {
          return this.localeData().weekdays(this, format);
      });

      addFormatToken('e', 0, 0, 'weekday');
      addFormatToken('E', 0, 0, 'isoWeekday');

      // ALIASES

      addUnitAlias('day', 'd');
      addUnitAlias('weekday', 'e');
      addUnitAlias('isoWeekday', 'E');

      // PRIORITY
      addUnitPriority('day', 11);
      addUnitPriority('weekday', 11);
      addUnitPriority('isoWeekday', 11);

      // PARSING

      addRegexToken('d',    match1to2);
      addRegexToken('e',    match1to2);
      addRegexToken('E',    match1to2);
      addRegexToken('dd',   function (isStrict, locale) {
          return locale.weekdaysMinRegex(isStrict);
      });
      addRegexToken('ddd',   function (isStrict, locale) {
          return locale.weekdaysShortRegex(isStrict);
      });
      addRegexToken('dddd',   function (isStrict, locale) {
          return locale.weekdaysRegex(isStrict);
      });

      addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
          var weekday = config._locale.weekdaysParse(input, token, config._strict);
          // if we didn't get a weekday name, mark the date as invalid
          if (weekday != null) {
              week.d = weekday;
          } else {
              getParsingFlags(config).invalidWeekday = input;
          }
      });

      addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
          week[token] = toInt(input);
      });

      // HELPERS

      function parseWeekday(input, locale) {
          if (typeof input !== 'string') {
              return input;
          }

          if (!isNaN(input)) {
              return parseInt(input, 10);
          }

          input = locale.weekdaysParse(input);
          if (typeof input === 'number') {
              return input;
          }

          return null;
      }

      function parseIsoWeekday(input, locale) {
          if (typeof input === 'string') {
              return locale.weekdaysParse(input) % 7 || 7;
          }
          return isNaN(input) ? null : input;
      }

      // LOCALES
      function shiftWeekdays (ws, n) {
          return ws.slice(n, 7).concat(ws.slice(0, n));
      }

      var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
      function localeWeekdays (m, format) {
          var weekdays = isArray(this._weekdays) ? this._weekdays :
              this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
          return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
              : (m) ? weekdays[m.day()] : weekdays;
      }

      var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
      function localeWeekdaysShort (m) {
          return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
              : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
      }

      var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
      function localeWeekdaysMin (m) {
          return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
              : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
      }

      function handleStrictParse$1(weekdayName, format, strict) {
          var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
          if (!this._weekdaysParse) {
              this._weekdaysParse = [];
              this._shortWeekdaysParse = [];
              this._minWeekdaysParse = [];

              for (i = 0; i < 7; ++i) {
                  mom = createUTC([2000, 1]).day(i);
                  this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                  this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                  this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
              }
          }

          if (strict) {
              if (format === 'dddd') {
                  ii = indexOf.call(this._weekdaysParse, llc);
                  return ii !== -1 ? ii : null;
              } else if (format === 'ddd') {
                  ii = indexOf.call(this._shortWeekdaysParse, llc);
                  return ii !== -1 ? ii : null;
              } else {
                  ii = indexOf.call(this._minWeekdaysParse, llc);
                  return ii !== -1 ? ii : null;
              }
          } else {
              if (format === 'dddd') {
                  ii = indexOf.call(this._weekdaysParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._shortWeekdaysParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._minWeekdaysParse, llc);
                  return ii !== -1 ? ii : null;
              } else if (format === 'ddd') {
                  ii = indexOf.call(this._shortWeekdaysParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._weekdaysParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._minWeekdaysParse, llc);
                  return ii !== -1 ? ii : null;
              } else {
                  ii = indexOf.call(this._minWeekdaysParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._weekdaysParse, llc);
                  if (ii !== -1) {
                      return ii;
                  }
                  ii = indexOf.call(this._shortWeekdaysParse, llc);
                  return ii !== -1 ? ii : null;
              }
          }
      }

      function localeWeekdaysParse (weekdayName, format, strict) {
          var i, mom, regex;

          if (this._weekdaysParseExact) {
              return handleStrictParse$1.call(this, weekdayName, format, strict);
          }

          if (!this._weekdaysParse) {
              this._weekdaysParse = [];
              this._minWeekdaysParse = [];
              this._shortWeekdaysParse = [];
              this._fullWeekdaysParse = [];
          }

          for (i = 0; i < 7; i++) {
              // make the regex if we don't have it already

              mom = createUTC([2000, 1]).day(i);
              if (strict && !this._fullWeekdaysParse[i]) {
                  this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                  this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                  this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
              }
              if (!this._weekdaysParse[i]) {
                  regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                  this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
              }
              // test the regex
              if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                  return i;
              } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                  return i;
              } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                  return i;
              } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                  return i;
              }
          }
      }

      // MOMENTS

      function getSetDayOfWeek (input) {
          if (!this.isValid()) {
              return input != null ? this : NaN;
          }
          var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
          if (input != null) {
              input = parseWeekday(input, this.localeData());
              return this.add(input - day, 'd');
          } else {
              return day;
          }
      }

      function getSetLocaleDayOfWeek (input) {
          if (!this.isValid()) {
              return input != null ? this : NaN;
          }
          var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
          return input == null ? weekday : this.add(input - weekday, 'd');
      }

      function getSetISODayOfWeek (input) {
          if (!this.isValid()) {
              return input != null ? this : NaN;
          }

          // behaves the same as moment#day except
          // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
          // as a setter, sunday should belong to the previous week.

          if (input != null) {
              var weekday = parseIsoWeekday(input, this.localeData());
              return this.day(this.day() % 7 ? weekday : weekday - 7);
          } else {
              return this.day() || 7;
          }
      }

      var defaultWeekdaysRegex = matchWord;
      function weekdaysRegex (isStrict) {
          if (this._weekdaysParseExact) {
              if (!hasOwnProp(this, '_weekdaysRegex')) {
                  computeWeekdaysParse.call(this);
              }
              if (isStrict) {
                  return this._weekdaysStrictRegex;
              } else {
                  return this._weekdaysRegex;
              }
          } else {
              if (!hasOwnProp(this, '_weekdaysRegex')) {
                  this._weekdaysRegex = defaultWeekdaysRegex;
              }
              return this._weekdaysStrictRegex && isStrict ?
                  this._weekdaysStrictRegex : this._weekdaysRegex;
          }
      }

      var defaultWeekdaysShortRegex = matchWord;
      function weekdaysShortRegex (isStrict) {
          if (this._weekdaysParseExact) {
              if (!hasOwnProp(this, '_weekdaysRegex')) {
                  computeWeekdaysParse.call(this);
              }
              if (isStrict) {
                  return this._weekdaysShortStrictRegex;
              } else {
                  return this._weekdaysShortRegex;
              }
          } else {
              if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                  this._weekdaysShortRegex = defaultWeekdaysShortRegex;
              }
              return this._weekdaysShortStrictRegex && isStrict ?
                  this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
          }
      }

      var defaultWeekdaysMinRegex = matchWord;
      function weekdaysMinRegex (isStrict) {
          if (this._weekdaysParseExact) {
              if (!hasOwnProp(this, '_weekdaysRegex')) {
                  computeWeekdaysParse.call(this);
              }
              if (isStrict) {
                  return this._weekdaysMinStrictRegex;
              } else {
                  return this._weekdaysMinRegex;
              }
          } else {
              if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                  this._weekdaysMinRegex = defaultWeekdaysMinRegex;
              }
              return this._weekdaysMinStrictRegex && isStrict ?
                  this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
          }
      }


      function computeWeekdaysParse () {
          function cmpLenRev(a, b) {
              return b.length - a.length;
          }

          var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
              i, mom, minp, shortp, longp;
          for (i = 0; i < 7; i++) {
              // make the regex if we don't have it already
              mom = createUTC([2000, 1]).day(i);
              minp = this.weekdaysMin(mom, '');
              shortp = this.weekdaysShort(mom, '');
              longp = this.weekdays(mom, '');
              minPieces.push(minp);
              shortPieces.push(shortp);
              longPieces.push(longp);
              mixedPieces.push(minp);
              mixedPieces.push(shortp);
              mixedPieces.push(longp);
          }
          // Sorting makes sure if one weekday (or abbr) is a prefix of another it
          // will match the longer piece.
          minPieces.sort(cmpLenRev);
          shortPieces.sort(cmpLenRev);
          longPieces.sort(cmpLenRev);
          mixedPieces.sort(cmpLenRev);
          for (i = 0; i < 7; i++) {
              shortPieces[i] = regexEscape(shortPieces[i]);
              longPieces[i] = regexEscape(longPieces[i]);
              mixedPieces[i] = regexEscape(mixedPieces[i]);
          }

          this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
          this._weekdaysShortRegex = this._weekdaysRegex;
          this._weekdaysMinRegex = this._weekdaysRegex;

          this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
          this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
          this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
      }

      // FORMATTING

      function hFormat() {
          return this.hours() % 12 || 12;
      }

      function kFormat() {
          return this.hours() || 24;
      }

      addFormatToken('H', ['HH', 2], 0, 'hour');
      addFormatToken('h', ['hh', 2], 0, hFormat);
      addFormatToken('k', ['kk', 2], 0, kFormat);

      addFormatToken('hmm', 0, 0, function () {
          return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
      });

      addFormatToken('hmmss', 0, 0, function () {
          return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
              zeroFill(this.seconds(), 2);
      });

      addFormatToken('Hmm', 0, 0, function () {
          return '' + this.hours() + zeroFill(this.minutes(), 2);
      });

      addFormatToken('Hmmss', 0, 0, function () {
          return '' + this.hours() + zeroFill(this.minutes(), 2) +
              zeroFill(this.seconds(), 2);
      });

      function meridiem (token, lowercase) {
          addFormatToken(token, 0, 0, function () {
              return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
          });
      }

      meridiem('a', true);
      meridiem('A', false);

      // ALIASES

      addUnitAlias('hour', 'h');

      // PRIORITY
      addUnitPriority('hour', 13);

      // PARSING

      function matchMeridiem (isStrict, locale) {
          return locale._meridiemParse;
      }

      addRegexToken('a',  matchMeridiem);
      addRegexToken('A',  matchMeridiem);
      addRegexToken('H',  match1to2);
      addRegexToken('h',  match1to2);
      addRegexToken('k',  match1to2);
      addRegexToken('HH', match1to2, match2);
      addRegexToken('hh', match1to2, match2);
      addRegexToken('kk', match1to2, match2);

      addRegexToken('hmm', match3to4);
      addRegexToken('hmmss', match5to6);
      addRegexToken('Hmm', match3to4);
      addRegexToken('Hmmss', match5to6);

      addParseToken(['H', 'HH'], HOUR);
      addParseToken(['k', 'kk'], function (input, array, config) {
          var kInput = toInt(input);
          array[HOUR] = kInput === 24 ? 0 : kInput;
      });
      addParseToken(['a', 'A'], function (input, array, config) {
          config._isPm = config._locale.isPM(input);
          config._meridiem = input;
      });
      addParseToken(['h', 'hh'], function (input, array, config) {
          array[HOUR] = toInt(input);
          getParsingFlags(config).bigHour = true;
      });
      addParseToken('hmm', function (input, array, config) {
          var pos = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
          getParsingFlags(config).bigHour = true;
      });
      addParseToken('hmmss', function (input, array, config) {
          var pos1 = input.length - 4;
          var pos2 = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
          getParsingFlags(config).bigHour = true;
      });
      addParseToken('Hmm', function (input, array, config) {
          var pos = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
      });
      addParseToken('Hmmss', function (input, array, config) {
          var pos1 = input.length - 4;
          var pos2 = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
      });

      // LOCALES

      function localeIsPM (input) {
          // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
          // Using charAt should be more compatible.
          return ((input + '').toLowerCase().charAt(0) === 'p');
      }

      var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
      function localeMeridiem (hours, minutes, isLower) {
          if (hours > 11) {
              return isLower ? 'pm' : 'PM';
          } else {
              return isLower ? 'am' : 'AM';
          }
      }


      // MOMENTS

      // Setting the hour should keep the time, because the user explicitly
      // specified which hour they want. So trying to maintain the same hour (in
      // a new timezone) makes sense. Adding/subtracting hours does not follow
      // this rule.
      var getSetHour = makeGetSet('Hours', true);

      var baseConfig = {
          calendar: defaultCalendar,
          longDateFormat: defaultLongDateFormat,
          invalidDate: defaultInvalidDate,
          ordinal: defaultOrdinal,
          dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
          relativeTime: defaultRelativeTime,

          months: defaultLocaleMonths,
          monthsShort: defaultLocaleMonthsShort,

          week: defaultLocaleWeek,

          weekdays: defaultLocaleWeekdays,
          weekdaysMin: defaultLocaleWeekdaysMin,
          weekdaysShort: defaultLocaleWeekdaysShort,

          meridiemParse: defaultLocaleMeridiemParse
      };

      // internal storage for locale config files
      var locales = {};
      var localeFamilies = {};
      var globalLocale;

      function normalizeLocale(key) {
          return key ? key.toLowerCase().replace('_', '-') : key;
      }

      // pick the locale from the array
      // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
      // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
      function chooseLocale(names) {
          var i = 0, j, next, locale, split;

          while (i < names.length) {
              split = normalizeLocale(names[i]).split('-');
              j = split.length;
              next = normalizeLocale(names[i + 1]);
              next = next ? next.split('-') : null;
              while (j > 0) {
                  locale = loadLocale(split.slice(0, j).join('-'));
                  if (locale) {
                      return locale;
                  }
                  if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                      //the next array item is better than a shallower substring of this one
                      break;
                  }
                  j--;
              }
              i++;
          }
          return globalLocale;
      }

      function loadLocale(name) {
          var oldLocale = null;
          // TODO: Find a better way to register and load all the locales in Node
          if (!locales[name] && ('object' !== 'undefined') &&
                  module && module.exports) {
              try {
                  oldLocale = globalLocale._abbr;
                  var aliasedRequire = commonjsRequire;
                  aliasedRequire('./locale/' + name);
                  getSetGlobalLocale(oldLocale);
              } catch (e) {}
          }
          return locales[name];
      }

      // This function will load locale and then set the global locale.  If
      // no arguments are passed in, it will simply return the current global
      // locale key.
      function getSetGlobalLocale (key, values) {
          var data;
          if (key) {
              if (isUndefined(values)) {
                  data = getLocale(key);
              }
              else {
                  data = defineLocale(key, values);
              }

              if (data) {
                  // moment.duration._locale = moment._locale = data;
                  globalLocale = data;
              }
              else {
                  if ((typeof console !==  'undefined') && console.warn) {
                      //warn user if arguments are passed but the locale could not be set
                      console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                  }
              }
          }

          return globalLocale._abbr;
      }

      function defineLocale (name, config) {
          if (config !== null) {
              var locale, parentConfig = baseConfig;
              config.abbr = name;
              if (locales[name] != null) {
                  deprecateSimple('defineLocaleOverride',
                          'use moment.updateLocale(localeName, config) to change ' +
                          'an existing locale. moment.defineLocale(localeName, ' +
                          'config) should only be used for creating a new locale ' +
                          'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                  parentConfig = locales[name]._config;
              } else if (config.parentLocale != null) {
                  if (locales[config.parentLocale] != null) {
                      parentConfig = locales[config.parentLocale]._config;
                  } else {
                      locale = loadLocale(config.parentLocale);
                      if (locale != null) {
                          parentConfig = locale._config;
                      } else {
                          if (!localeFamilies[config.parentLocale]) {
                              localeFamilies[config.parentLocale] = [];
                          }
                          localeFamilies[config.parentLocale].push({
                              name: name,
                              config: config
                          });
                          return null;
                      }
                  }
              }
              locales[name] = new Locale(mergeConfigs(parentConfig, config));

              if (localeFamilies[name]) {
                  localeFamilies[name].forEach(function (x) {
                      defineLocale(x.name, x.config);
                  });
              }

              // backwards compat for now: also set the locale
              // make sure we set the locale AFTER all child locales have been
              // created, so we won't end up with the child locale set.
              getSetGlobalLocale(name);


              return locales[name];
          } else {
              // useful for testing
              delete locales[name];
              return null;
          }
      }

      function updateLocale(name, config) {
          if (config != null) {
              var locale, tmpLocale, parentConfig = baseConfig;
              // MERGE
              tmpLocale = loadLocale(name);
              if (tmpLocale != null) {
                  parentConfig = tmpLocale._config;
              }
              config = mergeConfigs(parentConfig, config);
              locale = new Locale(config);
              locale.parentLocale = locales[name];
              locales[name] = locale;

              // backwards compat for now: also set the locale
              getSetGlobalLocale(name);
          } else {
              // pass null for config to unupdate, useful for tests
              if (locales[name] != null) {
                  if (locales[name].parentLocale != null) {
                      locales[name] = locales[name].parentLocale;
                  } else if (locales[name] != null) {
                      delete locales[name];
                  }
              }
          }
          return locales[name];
      }

      // returns locale data
      function getLocale (key) {
          var locale;

          if (key && key._locale && key._locale._abbr) {
              key = key._locale._abbr;
          }

          if (!key) {
              return globalLocale;
          }

          if (!isArray(key)) {
              //short-circuit everything else
              locale = loadLocale(key);
              if (locale) {
                  return locale;
              }
              key = [key];
          }

          return chooseLocale(key);
      }

      function listLocales() {
          return keys(locales);
      }

      function checkOverflow (m) {
          var overflow;
          var a = m._a;

          if (a && getParsingFlags(m).overflow === -2) {
              overflow =
                  a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                  a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                  a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                  a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                  a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                  a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                  -1;

              if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                  overflow = DATE;
              }
              if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                  overflow = WEEK;
              }
              if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                  overflow = WEEKDAY;
              }

              getParsingFlags(m).overflow = overflow;
          }

          return m;
      }

      // Pick the first defined of two or three arguments.
      function defaults(a, b, c) {
          if (a != null) {
              return a;
          }
          if (b != null) {
              return b;
          }
          return c;
      }

      function currentDateArray(config) {
          // hooks is actually the exported moment object
          var nowValue = new Date(hooks.now());
          if (config._useUTC) {
              return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
          }
          return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
      }

      // convert an array to a date.
      // the array should mirror the parameters below
      // note: all values past the year are optional and will default to the lowest possible value.
      // [year, month, day , hour, minute, second, millisecond]
      function configFromArray (config) {
          var i, date, input = [], currentDate, expectedWeekday, yearToUse;

          if (config._d) {
              return;
          }

          currentDate = currentDateArray(config);

          //compute day of the year from weeks and weekdays
          if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
              dayOfYearFromWeekInfo(config);
          }

          //if the day of the year is set, figure out what it is
          if (config._dayOfYear != null) {
              yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

              if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                  getParsingFlags(config)._overflowDayOfYear = true;
              }

              date = createUTCDate(yearToUse, 0, config._dayOfYear);
              config._a[MONTH] = date.getUTCMonth();
              config._a[DATE] = date.getUTCDate();
          }

          // Default to current date.
          // * if no year, month, day of month are given, default to today
          // * if day of month is given, default month and year
          // * if month is given, default only year
          // * if year is given, don't default anything
          for (i = 0; i < 3 && config._a[i] == null; ++i) {
              config._a[i] = input[i] = currentDate[i];
          }

          // Zero out whatever was not defaulted, including time
          for (; i < 7; i++) {
              config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
          }

          // Check for 24:00:00.000
          if (config._a[HOUR] === 24 &&
                  config._a[MINUTE] === 0 &&
                  config._a[SECOND] === 0 &&
                  config._a[MILLISECOND] === 0) {
              config._nextDay = true;
              config._a[HOUR] = 0;
          }

          config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
          expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

          // Apply timezone offset from input. The actual utcOffset can be changed
          // with parseZone.
          if (config._tzm != null) {
              config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
          }

          if (config._nextDay) {
              config._a[HOUR] = 24;
          }

          // check for mismatching day of week
          if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
              getParsingFlags(config).weekdayMismatch = true;
          }
      }

      function dayOfYearFromWeekInfo(config) {
          var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

          w = config._w;
          if (w.GG != null || w.W != null || w.E != null) {
              dow = 1;
              doy = 4;

              // TODO: We need to take the current isoWeekYear, but that depends on
              // how we interpret now (local, utc, fixed offset). So create
              // a now version of current config (take local/utc/offset flags, and
              // create now).
              weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
              week = defaults(w.W, 1);
              weekday = defaults(w.E, 1);
              if (weekday < 1 || weekday > 7) {
                  weekdayOverflow = true;
              }
          } else {
              dow = config._locale._week.dow;
              doy = config._locale._week.doy;

              var curWeek = weekOfYear(createLocal(), dow, doy);

              weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

              // Default to current week.
              week = defaults(w.w, curWeek.week);

              if (w.d != null) {
                  // weekday -- low day numbers are considered next week
                  weekday = w.d;
                  if (weekday < 0 || weekday > 6) {
                      weekdayOverflow = true;
                  }
              } else if (w.e != null) {
                  // local weekday -- counting starts from beginning of week
                  weekday = w.e + dow;
                  if (w.e < 0 || w.e > 6) {
                      weekdayOverflow = true;
                  }
              } else {
                  // default to beginning of week
                  weekday = dow;
              }
          }
          if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
              getParsingFlags(config)._overflowWeeks = true;
          } else if (weekdayOverflow != null) {
              getParsingFlags(config)._overflowWeekday = true;
          } else {
              temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
              config._a[YEAR] = temp.year;
              config._dayOfYear = temp.dayOfYear;
          }
      }

      // iso 8601 regex
      // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
      var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
      var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

      var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

      var isoDates = [
          ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
          ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
          ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
          ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
          ['YYYY-DDD', /\d{4}-\d{3}/],
          ['YYYY-MM', /\d{4}-\d\d/, false],
          ['YYYYYYMMDD', /[+-]\d{10}/],
          ['YYYYMMDD', /\d{8}/],
          // YYYYMM is NOT allowed by the standard
          ['GGGG[W]WWE', /\d{4}W\d{3}/],
          ['GGGG[W]WW', /\d{4}W\d{2}/, false],
          ['YYYYDDD', /\d{7}/]
      ];

      // iso time formats and regexes
      var isoTimes = [
          ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
          ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
          ['HH:mm:ss', /\d\d:\d\d:\d\d/],
          ['HH:mm', /\d\d:\d\d/],
          ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
          ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
          ['HHmmss', /\d\d\d\d\d\d/],
          ['HHmm', /\d\d\d\d/],
          ['HH', /\d\d/]
      ];

      var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

      // date from iso format
      function configFromISO(config) {
          var i, l,
              string = config._i,
              match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
              allowTime, dateFormat, timeFormat, tzFormat;

          if (match) {
              getParsingFlags(config).iso = true;

              for (i = 0, l = isoDates.length; i < l; i++) {
                  if (isoDates[i][1].exec(match[1])) {
                      dateFormat = isoDates[i][0];
                      allowTime = isoDates[i][2] !== false;
                      break;
                  }
              }
              if (dateFormat == null) {
                  config._isValid = false;
                  return;
              }
              if (match[3]) {
                  for (i = 0, l = isoTimes.length; i < l; i++) {
                      if (isoTimes[i][1].exec(match[3])) {
                          // match[2] should be 'T' or space
                          timeFormat = (match[2] || ' ') + isoTimes[i][0];
                          break;
                      }
                  }
                  if (timeFormat == null) {
                      config._isValid = false;
                      return;
                  }
              }
              if (!allowTime && timeFormat != null) {
                  config._isValid = false;
                  return;
              }
              if (match[4]) {
                  if (tzRegex.exec(match[4])) {
                      tzFormat = 'Z';
                  } else {
                      config._isValid = false;
                      return;
                  }
              }
              config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
              configFromStringAndFormat(config);
          } else {
              config._isValid = false;
          }
      }

      // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
      var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

      function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
          var result = [
              untruncateYear(yearStr),
              defaultLocaleMonthsShort.indexOf(monthStr),
              parseInt(dayStr, 10),
              parseInt(hourStr, 10),
              parseInt(minuteStr, 10)
          ];

          if (secondStr) {
              result.push(parseInt(secondStr, 10));
          }

          return result;
      }

      function untruncateYear(yearStr) {
          var year = parseInt(yearStr, 10);
          if (year <= 49) {
              return 2000 + year;
          } else if (year <= 999) {
              return 1900 + year;
          }
          return year;
      }

      function preprocessRFC2822(s) {
          // Remove comments and folding whitespace and replace multiple-spaces with a single space
          return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
      }

      function checkWeekday(weekdayStr, parsedInput, config) {
          if (weekdayStr) {
              // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
              var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                  weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
              if (weekdayProvided !== weekdayActual) {
                  getParsingFlags(config).weekdayMismatch = true;
                  config._isValid = false;
                  return false;
              }
          }
          return true;
      }

      var obsOffsets = {
          UT: 0,
          GMT: 0,
          EDT: -4 * 60,
          EST: -5 * 60,
          CDT: -5 * 60,
          CST: -6 * 60,
          MDT: -6 * 60,
          MST: -7 * 60,
          PDT: -7 * 60,
          PST: -8 * 60
      };

      function calculateOffset(obsOffset, militaryOffset, numOffset) {
          if (obsOffset) {
              return obsOffsets[obsOffset];
          } else if (militaryOffset) {
              // the only allowed military tz is Z
              return 0;
          } else {
              var hm = parseInt(numOffset, 10);
              var m = hm % 100, h = (hm - m) / 100;
              return h * 60 + m;
          }
      }

      // date and time from ref 2822 format
      function configFromRFC2822(config) {
          var match = rfc2822.exec(preprocessRFC2822(config._i));
          if (match) {
              var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
              if (!checkWeekday(match[1], parsedArray, config)) {
                  return;
              }

              config._a = parsedArray;
              config._tzm = calculateOffset(match[8], match[9], match[10]);

              config._d = createUTCDate.apply(null, config._a);
              config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

              getParsingFlags(config).rfc2822 = true;
          } else {
              config._isValid = false;
          }
      }

      // date from iso format or fallback
      function configFromString(config) {
          var matched = aspNetJsonRegex.exec(config._i);

          if (matched !== null) {
              config._d = new Date(+matched[1]);
              return;
          }

          configFromISO(config);
          if (config._isValid === false) {
              delete config._isValid;
          } else {
              return;
          }

          configFromRFC2822(config);
          if (config._isValid === false) {
              delete config._isValid;
          } else {
              return;
          }

          // Final attempt, use Input Fallback
          hooks.createFromInputFallback(config);
      }

      hooks.createFromInputFallback = deprecate(
          'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
          'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
          'discouraged and will be removed in an upcoming major release. Please refer to ' +
          'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
          function (config) {
              config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
          }
      );

      // constant that refers to the ISO standard
      hooks.ISO_8601 = function () {};

      // constant that refers to the RFC 2822 form
      hooks.RFC_2822 = function () {};

      // date from string and format string
      function configFromStringAndFormat(config) {
          // TODO: Move this to another part of the creation flow to prevent circular deps
          if (config._f === hooks.ISO_8601) {
              configFromISO(config);
              return;
          }
          if (config._f === hooks.RFC_2822) {
              configFromRFC2822(config);
              return;
          }
          config._a = [];
          getParsingFlags(config).empty = true;

          // This array is used to make a Date, either with `new Date` or `Date.UTC`
          var string = '' + config._i,
              i, parsedInput, tokens, token, skipped,
              stringLength = string.length,
              totalParsedInputLength = 0;

          tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

          for (i = 0; i < tokens.length; i++) {
              token = tokens[i];
              parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
              // console.log('token', token, 'parsedInput', parsedInput,
              //         'regex', getParseRegexForToken(token, config));
              if (parsedInput) {
                  skipped = string.substr(0, string.indexOf(parsedInput));
                  if (skipped.length > 0) {
                      getParsingFlags(config).unusedInput.push(skipped);
                  }
                  string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                  totalParsedInputLength += parsedInput.length;
              }
              // don't parse if it's not a known token
              if (formatTokenFunctions[token]) {
                  if (parsedInput) {
                      getParsingFlags(config).empty = false;
                  }
                  else {
                      getParsingFlags(config).unusedTokens.push(token);
                  }
                  addTimeToArrayFromToken(token, parsedInput, config);
              }
              else if (config._strict && !parsedInput) {
                  getParsingFlags(config).unusedTokens.push(token);
              }
          }

          // add remaining unparsed input length to the string
          getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
          if (string.length > 0) {
              getParsingFlags(config).unusedInput.push(string);
          }

          // clear _12h flag if hour is <= 12
          if (config._a[HOUR] <= 12 &&
              getParsingFlags(config).bigHour === true &&
              config._a[HOUR] > 0) {
              getParsingFlags(config).bigHour = undefined;
          }

          getParsingFlags(config).parsedDateParts = config._a.slice(0);
          getParsingFlags(config).meridiem = config._meridiem;
          // handle meridiem
          config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

          configFromArray(config);
          checkOverflow(config);
      }


      function meridiemFixWrap (locale, hour, meridiem) {
          var isPm;

          if (meridiem == null) {
              // nothing to do
              return hour;
          }
          if (locale.meridiemHour != null) {
              return locale.meridiemHour(hour, meridiem);
          } else if (locale.isPM != null) {
              // Fallback
              isPm = locale.isPM(meridiem);
              if (isPm && hour < 12) {
                  hour += 12;
              }
              if (!isPm && hour === 12) {
                  hour = 0;
              }
              return hour;
          } else {
              // this is not supposed to happen
              return hour;
          }
      }

      // date from string and array of format strings
      function configFromStringAndArray(config) {
          var tempConfig,
              bestMoment,

              scoreToBeat,
              i,
              currentScore;

          if (config._f.length === 0) {
              getParsingFlags(config).invalidFormat = true;
              config._d = new Date(NaN);
              return;
          }

          for (i = 0; i < config._f.length; i++) {
              currentScore = 0;
              tempConfig = copyConfig({}, config);
              if (config._useUTC != null) {
                  tempConfig._useUTC = config._useUTC;
              }
              tempConfig._f = config._f[i];
              configFromStringAndFormat(tempConfig);

              if (!isValid(tempConfig)) {
                  continue;
              }

              // if there is any input that was not parsed add a penalty for that format
              currentScore += getParsingFlags(tempConfig).charsLeftOver;

              //or tokens
              currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

              getParsingFlags(tempConfig).score = currentScore;

              if (scoreToBeat == null || currentScore < scoreToBeat) {
                  scoreToBeat = currentScore;
                  bestMoment = tempConfig;
              }
          }

          extend(config, bestMoment || tempConfig);
      }

      function configFromObject(config) {
          if (config._d) {
              return;
          }

          var i = normalizeObjectUnits(config._i);
          config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
              return obj && parseInt(obj, 10);
          });

          configFromArray(config);
      }

      function createFromConfig (config) {
          var res = new Moment(checkOverflow(prepareConfig(config)));
          if (res._nextDay) {
              // Adding is smart enough around DST
              res.add(1, 'd');
              res._nextDay = undefined;
          }

          return res;
      }

      function prepareConfig (config) {
          var input = config._i,
              format = config._f;

          config._locale = config._locale || getLocale(config._l);

          if (input === null || (format === undefined && input === '')) {
              return createInvalid({nullInput: true});
          }

          if (typeof input === 'string') {
              config._i = input = config._locale.preparse(input);
          }

          if (isMoment(input)) {
              return new Moment(checkOverflow(input));
          } else if (isDate(input)) {
              config._d = input;
          } else if (isArray(format)) {
              configFromStringAndArray(config);
          } else if (format) {
              configFromStringAndFormat(config);
          }  else {
              configFromInput(config);
          }

          if (!isValid(config)) {
              config._d = null;
          }

          return config;
      }

      function configFromInput(config) {
          var input = config._i;
          if (isUndefined(input)) {
              config._d = new Date(hooks.now());
          } else if (isDate(input)) {
              config._d = new Date(input.valueOf());
          } else if (typeof input === 'string') {
              configFromString(config);
          } else if (isArray(input)) {
              config._a = map(input.slice(0), function (obj) {
                  return parseInt(obj, 10);
              });
              configFromArray(config);
          } else if (isObject(input)) {
              configFromObject(config);
          } else if (isNumber(input)) {
              // from milliseconds
              config._d = new Date(input);
          } else {
              hooks.createFromInputFallback(config);
          }
      }

      function createLocalOrUTC (input, format, locale, strict, isUTC) {
          var c = {};

          if (locale === true || locale === false) {
              strict = locale;
              locale = undefined;
          }

          if ((isObject(input) && isObjectEmpty(input)) ||
                  (isArray(input) && input.length === 0)) {
              input = undefined;
          }
          // object construction must be done this way.
          // https://github.com/moment/moment/issues/1423
          c._isAMomentObject = true;
          c._useUTC = c._isUTC = isUTC;
          c._l = locale;
          c._i = input;
          c._f = format;
          c._strict = strict;

          return createFromConfig(c);
      }

      function createLocal (input, format, locale, strict) {
          return createLocalOrUTC(input, format, locale, strict, false);
      }

      var prototypeMin = deprecate(
          'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
          function () {
              var other = createLocal.apply(null, arguments);
              if (this.isValid() && other.isValid()) {
                  return other < this ? this : other;
              } else {
                  return createInvalid();
              }
          }
      );

      var prototypeMax = deprecate(
          'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
          function () {
              var other = createLocal.apply(null, arguments);
              if (this.isValid() && other.isValid()) {
                  return other > this ? this : other;
              } else {
                  return createInvalid();
              }
          }
      );

      // Pick a moment m from moments so that m[fn](other) is true for all
      // other. This relies on the function fn to be transitive.
      //
      // moments should either be an array of moment objects or an array, whose
      // first element is an array of moment objects.
      function pickBy(fn, moments) {
          var res, i;
          if (moments.length === 1 && isArray(moments[0])) {
              moments = moments[0];
          }
          if (!moments.length) {
              return createLocal();
          }
          res = moments[0];
          for (i = 1; i < moments.length; ++i) {
              if (!moments[i].isValid() || moments[i][fn](res)) {
                  res = moments[i];
              }
          }
          return res;
      }

      // TODO: Use [].sort instead?
      function min () {
          var args = [].slice.call(arguments, 0);

          return pickBy('isBefore', args);
      }

      function max () {
          var args = [].slice.call(arguments, 0);

          return pickBy('isAfter', args);
      }

      var now = function () {
          return Date.now ? Date.now() : +(new Date());
      };

      var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

      function isDurationValid(m) {
          for (var key in m) {
              if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                  return false;
              }
          }

          var unitHasDecimal = false;
          for (var i = 0; i < ordering.length; ++i) {
              if (m[ordering[i]]) {
                  if (unitHasDecimal) {
                      return false; // only allow non-integers for smallest unit
                  }
                  if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                      unitHasDecimal = true;
                  }
              }
          }

          return true;
      }

      function isValid$1() {
          return this._isValid;
      }

      function createInvalid$1() {
          return createDuration(NaN);
      }

      function Duration (duration) {
          var normalizedInput = normalizeObjectUnits(duration),
              years = normalizedInput.year || 0,
              quarters = normalizedInput.quarter || 0,
              months = normalizedInput.month || 0,
              weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
              days = normalizedInput.day || 0,
              hours = normalizedInput.hour || 0,
              minutes = normalizedInput.minute || 0,
              seconds = normalizedInput.second || 0,
              milliseconds = normalizedInput.millisecond || 0;

          this._isValid = isDurationValid(normalizedInput);

          // representation for dateAddRemove
          this._milliseconds = +milliseconds +
              seconds * 1e3 + // 1000
              minutes * 6e4 + // 1000 * 60
              hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
          // Because of dateAddRemove treats 24 hours as different from a
          // day when working around DST, we need to store them separately
          this._days = +days +
              weeks * 7;
          // It is impossible to translate months into days without knowing
          // which months you are are talking about, so we have to store
          // it separately.
          this._months = +months +
              quarters * 3 +
              years * 12;

          this._data = {};

          this._locale = getLocale();

          this._bubble();
      }

      function isDuration (obj) {
          return obj instanceof Duration;
      }

      function absRound (number) {
          if (number < 0) {
              return Math.round(-1 * number) * -1;
          } else {
              return Math.round(number);
          }
      }

      // FORMATTING

      function offset (token, separator) {
          addFormatToken(token, 0, 0, function () {
              var offset = this.utcOffset();
              var sign = '+';
              if (offset < 0) {
                  offset = -offset;
                  sign = '-';
              }
              return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
          });
      }

      offset('Z', ':');
      offset('ZZ', '');

      // PARSING

      addRegexToken('Z',  matchShortOffset);
      addRegexToken('ZZ', matchShortOffset);
      addParseToken(['Z', 'ZZ'], function (input, array, config) {
          config._useUTC = true;
          config._tzm = offsetFromString(matchShortOffset, input);
      });

      // HELPERS

      // timezone chunker
      // '+10:00' > ['10',  '00']
      // '-1530'  > ['-15', '30']
      var chunkOffset = /([\+\-]|\d\d)/gi;

      function offsetFromString(matcher, string) {
          var matches = (string || '').match(matcher);

          if (matches === null) {
              return null;
          }

          var chunk   = matches[matches.length - 1] || [];
          var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
          var minutes = +(parts[1] * 60) + toInt(parts[2]);

          return minutes === 0 ?
            0 :
            parts[0] === '+' ? minutes : -minutes;
      }

      // Return a moment from input, that is local/utc/zone equivalent to model.
      function cloneWithOffset(input, model) {
          var res, diff;
          if (model._isUTC) {
              res = model.clone();
              diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
              // Use low-level api, because this fn is low-level api.
              res._d.setTime(res._d.valueOf() + diff);
              hooks.updateOffset(res, false);
              return res;
          } else {
              return createLocal(input).local();
          }
      }

      function getDateOffset (m) {
          // On Firefox.24 Date#getTimezoneOffset returns a floating point.
          // https://github.com/moment/moment/pull/1871
          return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
      }

      // HOOKS

      // This function will be called whenever a moment is mutated.
      // It is intended to keep the offset in sync with the timezone.
      hooks.updateOffset = function () {};

      // MOMENTS

      // keepLocalTime = true means only change the timezone, without
      // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
      // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
      // +0200, so we adjust the time as needed, to be valid.
      //
      // Keeping the time actually adds/subtracts (one hour)
      // from the actual represented time. That is why we call updateOffset
      // a second time. In case it wants us to change the offset again
      // _changeInProgress == true case, then we have to adjust, because
      // there is no such time in the given timezone.
      function getSetOffset (input, keepLocalTime, keepMinutes) {
          var offset = this._offset || 0,
              localAdjust;
          if (!this.isValid()) {
              return input != null ? this : NaN;
          }
          if (input != null) {
              if (typeof input === 'string') {
                  input = offsetFromString(matchShortOffset, input);
                  if (input === null) {
                      return this;
                  }
              } else if (Math.abs(input) < 16 && !keepMinutes) {
                  input = input * 60;
              }
              if (!this._isUTC && keepLocalTime) {
                  localAdjust = getDateOffset(this);
              }
              this._offset = input;
              this._isUTC = true;
              if (localAdjust != null) {
                  this.add(localAdjust, 'm');
              }
              if (offset !== input) {
                  if (!keepLocalTime || this._changeInProgress) {
                      addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                  } else if (!this._changeInProgress) {
                      this._changeInProgress = true;
                      hooks.updateOffset(this, true);
                      this._changeInProgress = null;
                  }
              }
              return this;
          } else {
              return this._isUTC ? offset : getDateOffset(this);
          }
      }

      function getSetZone (input, keepLocalTime) {
          if (input != null) {
              if (typeof input !== 'string') {
                  input = -input;
              }

              this.utcOffset(input, keepLocalTime);

              return this;
          } else {
              return -this.utcOffset();
          }
      }

      function setOffsetToUTC (keepLocalTime) {
          return this.utcOffset(0, keepLocalTime);
      }

      function setOffsetToLocal (keepLocalTime) {
          if (this._isUTC) {
              this.utcOffset(0, keepLocalTime);
              this._isUTC = false;

              if (keepLocalTime) {
                  this.subtract(getDateOffset(this), 'm');
              }
          }
          return this;
      }

      function setOffsetToParsedOffset () {
          if (this._tzm != null) {
              this.utcOffset(this._tzm, false, true);
          } else if (typeof this._i === 'string') {
              var tZone = offsetFromString(matchOffset, this._i);
              if (tZone != null) {
                  this.utcOffset(tZone);
              }
              else {
                  this.utcOffset(0, true);
              }
          }
          return this;
      }

      function hasAlignedHourOffset (input) {
          if (!this.isValid()) {
              return false;
          }
          input = input ? createLocal(input).utcOffset() : 0;

          return (this.utcOffset() - input) % 60 === 0;
      }

      function isDaylightSavingTime () {
          return (
              this.utcOffset() > this.clone().month(0).utcOffset() ||
              this.utcOffset() > this.clone().month(5).utcOffset()
          );
      }

      function isDaylightSavingTimeShifted () {
          if (!isUndefined(this._isDSTShifted)) {
              return this._isDSTShifted;
          }

          var c = {};

          copyConfig(c, this);
          c = prepareConfig(c);

          if (c._a) {
              var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
              this._isDSTShifted = this.isValid() &&
                  compareArrays(c._a, other.toArray()) > 0;
          } else {
              this._isDSTShifted = false;
          }

          return this._isDSTShifted;
      }

      function isLocal () {
          return this.isValid() ? !this._isUTC : false;
      }

      function isUtcOffset () {
          return this.isValid() ? this._isUTC : false;
      }

      function isUtc () {
          return this.isValid() ? this._isUTC && this._offset === 0 : false;
      }

      // ASP.NET json date format regex
      var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

      // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
      // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
      // and further modified to allow for strings containing both week and day
      var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

      function createDuration (input, key) {
          var duration = input,
              // matching against regexp is expensive, do it on demand
              match = null,
              sign,
              ret,
              diffRes;

          if (isDuration(input)) {
              duration = {
                  ms : input._milliseconds,
                  d  : input._days,
                  M  : input._months
              };
          } else if (isNumber(input)) {
              duration = {};
              if (key) {
                  duration[key] = input;
              } else {
                  duration.milliseconds = input;
              }
          } else if (!!(match = aspNetRegex.exec(input))) {
              sign = (match[1] === '-') ? -1 : 1;
              duration = {
                  y  : 0,
                  d  : toInt(match[DATE])                         * sign,
                  h  : toInt(match[HOUR])                         * sign,
                  m  : toInt(match[MINUTE])                       * sign,
                  s  : toInt(match[SECOND])                       * sign,
                  ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
              };
          } else if (!!(match = isoRegex.exec(input))) {
              sign = (match[1] === '-') ? -1 : 1;
              duration = {
                  y : parseIso(match[2], sign),
                  M : parseIso(match[3], sign),
                  w : parseIso(match[4], sign),
                  d : parseIso(match[5], sign),
                  h : parseIso(match[6], sign),
                  m : parseIso(match[7], sign),
                  s : parseIso(match[8], sign)
              };
          } else if (duration == null) {// checks for null or undefined
              duration = {};
          } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
              diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

              duration = {};
              duration.ms = diffRes.milliseconds;
              duration.M = diffRes.months;
          }

          ret = new Duration(duration);

          if (isDuration(input) && hasOwnProp(input, '_locale')) {
              ret._locale = input._locale;
          }

          return ret;
      }

      createDuration.fn = Duration.prototype;
      createDuration.invalid = createInvalid$1;

      function parseIso (inp, sign) {
          // We'd normally use ~~inp for this, but unfortunately it also
          // converts floats to ints.
          // inp may be undefined, so careful calling replace on it.
          var res = inp && parseFloat(inp.replace(',', '.'));
          // apply sign while we're at it
          return (isNaN(res) ? 0 : res) * sign;
      }

      function positiveMomentsDifference(base, other) {
          var res = {};

          res.months = other.month() - base.month() +
              (other.year() - base.year()) * 12;
          if (base.clone().add(res.months, 'M').isAfter(other)) {
              --res.months;
          }

          res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

          return res;
      }

      function momentsDifference(base, other) {
          var res;
          if (!(base.isValid() && other.isValid())) {
              return {milliseconds: 0, months: 0};
          }

          other = cloneWithOffset(other, base);
          if (base.isBefore(other)) {
              res = positiveMomentsDifference(base, other);
          } else {
              res = positiveMomentsDifference(other, base);
              res.milliseconds = -res.milliseconds;
              res.months = -res.months;
          }

          return res;
      }

      // TODO: remove 'name' arg after deprecation is removed
      function createAdder(direction, name) {
          return function (val, period) {
              var dur, tmp;
              //invert the arguments, but complain about it
              if (period !== null && !isNaN(+period)) {
                  deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                  'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                  tmp = val; val = period; period = tmp;
              }

              val = typeof val === 'string' ? +val : val;
              dur = createDuration(val, period);
              addSubtract(this, dur, direction);
              return this;
          };
      }

      function addSubtract (mom, duration, isAdding, updateOffset) {
          var milliseconds = duration._milliseconds,
              days = absRound(duration._days),
              months = absRound(duration._months);

          if (!mom.isValid()) {
              // No op
              return;
          }

          updateOffset = updateOffset == null ? true : updateOffset;

          if (months) {
              setMonth(mom, get(mom, 'Month') + months * isAdding);
          }
          if (days) {
              set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
          }
          if (milliseconds) {
              mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
          }
          if (updateOffset) {
              hooks.updateOffset(mom, days || months);
          }
      }

      var add      = createAdder(1, 'add');
      var subtract = createAdder(-1, 'subtract');

      function getCalendarFormat(myMoment, now) {
          var diff = myMoment.diff(now, 'days', true);
          return diff < -6 ? 'sameElse' :
                  diff < -1 ? 'lastWeek' :
                  diff < 0 ? 'lastDay' :
                  diff < 1 ? 'sameDay' :
                  diff < 2 ? 'nextDay' :
                  diff < 7 ? 'nextWeek' : 'sameElse';
      }

      function calendar$1 (time, formats) {
          // We want to compare the start of today, vs this.
          // Getting start-of-today depends on whether we're local/utc/offset or not.
          var now = time || createLocal(),
              sod = cloneWithOffset(now, this).startOf('day'),
              format = hooks.calendarFormat(this, sod) || 'sameElse';

          var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

          return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
      }

      function clone () {
          return new Moment(this);
      }

      function isAfter (input, units) {
          var localInput = isMoment(input) ? input : createLocal(input);
          if (!(this.isValid() && localInput.isValid())) {
              return false;
          }
          units = normalizeUnits(units) || 'millisecond';
          if (units === 'millisecond') {
              return this.valueOf() > localInput.valueOf();
          } else {
              return localInput.valueOf() < this.clone().startOf(units).valueOf();
          }
      }

      function isBefore (input, units) {
          var localInput = isMoment(input) ? input : createLocal(input);
          if (!(this.isValid() && localInput.isValid())) {
              return false;
          }
          units = normalizeUnits(units) || 'millisecond';
          if (units === 'millisecond') {
              return this.valueOf() < localInput.valueOf();
          } else {
              return this.clone().endOf(units).valueOf() < localInput.valueOf();
          }
      }

      function isBetween (from, to, units, inclusivity) {
          var localFrom = isMoment(from) ? from : createLocal(from),
              localTo = isMoment(to) ? to : createLocal(to);
          if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
              return false;
          }
          inclusivity = inclusivity || '()';
          return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
              (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
      }

      function isSame (input, units) {
          var localInput = isMoment(input) ? input : createLocal(input),
              inputMs;
          if (!(this.isValid() && localInput.isValid())) {
              return false;
          }
          units = normalizeUnits(units) || 'millisecond';
          if (units === 'millisecond') {
              return this.valueOf() === localInput.valueOf();
          } else {
              inputMs = localInput.valueOf();
              return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
          }
      }

      function isSameOrAfter (input, units) {
          return this.isSame(input, units) || this.isAfter(input, units);
      }

      function isSameOrBefore (input, units) {
          return this.isSame(input, units) || this.isBefore(input, units);
      }

      function diff (input, units, asFloat) {
          var that,
              zoneDelta,
              output;

          if (!this.isValid()) {
              return NaN;
          }

          that = cloneWithOffset(input, this);

          if (!that.isValid()) {
              return NaN;
          }

          zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

          units = normalizeUnits(units);

          switch (units) {
              case 'year': output = monthDiff(this, that) / 12; break;
              case 'month': output = monthDiff(this, that); break;
              case 'quarter': output = monthDiff(this, that) / 3; break;
              case 'second': output = (this - that) / 1e3; break; // 1000
              case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
              case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
              case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
              case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
              default: output = this - that;
          }

          return asFloat ? output : absFloor(output);
      }

      function monthDiff (a, b) {
          // difference in months
          var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
              // b is in (anchor - 1 month, anchor + 1 month)
              anchor = a.clone().add(wholeMonthDiff, 'months'),
              anchor2, adjust;

          if (b - anchor < 0) {
              anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
              // linear across the month
              adjust = (b - anchor) / (anchor - anchor2);
          } else {
              anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
              // linear across the month
              adjust = (b - anchor) / (anchor2 - anchor);
          }

          //check for negative zero, return zero if negative zero
          return -(wholeMonthDiff + adjust) || 0;
      }

      hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
      hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

      function toString () {
          return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
      }

      function toISOString(keepOffset) {
          if (!this.isValid()) {
              return null;
          }
          var utc = keepOffset !== true;
          var m = utc ? this.clone().utc() : this;
          if (m.year() < 0 || m.year() > 9999) {
              return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
          }
          if (isFunction(Date.prototype.toISOString)) {
              // native implementation is ~50x faster, use it when we can
              if (utc) {
                  return this.toDate().toISOString();
              } else {
                  return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
              }
          }
          return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
      }

      /**
       * Return a human readable representation of a moment that can
       * also be evaluated to get a new moment which is the same
       *
       * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
       */
      function inspect () {
          if (!this.isValid()) {
              return 'moment.invalid(/* ' + this._i + ' */)';
          }
          var func = 'moment';
          var zone = '';
          if (!this.isLocal()) {
              func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
              zone = 'Z';
          }
          var prefix = '[' + func + '("]';
          var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
          var datetime = '-MM-DD[T]HH:mm:ss.SSS';
          var suffix = zone + '[")]';

          return this.format(prefix + year + datetime + suffix);
      }

      function format (inputString) {
          if (!inputString) {
              inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
          }
          var output = formatMoment(this, inputString);
          return this.localeData().postformat(output);
      }

      function from (time, withoutSuffix) {
          if (this.isValid() &&
                  ((isMoment(time) && time.isValid()) ||
                   createLocal(time).isValid())) {
              return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
          } else {
              return this.localeData().invalidDate();
          }
      }

      function fromNow (withoutSuffix) {
          return this.from(createLocal(), withoutSuffix);
      }

      function to (time, withoutSuffix) {
          if (this.isValid() &&
                  ((isMoment(time) && time.isValid()) ||
                   createLocal(time).isValid())) {
              return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
          } else {
              return this.localeData().invalidDate();
          }
      }

      function toNow (withoutSuffix) {
          return this.to(createLocal(), withoutSuffix);
      }

      // If passed a locale key, it will set the locale for this
      // instance.  Otherwise, it will return the locale configuration
      // variables for this instance.
      function locale (key) {
          var newLocaleData;

          if (key === undefined) {
              return this._locale._abbr;
          } else {
              newLocaleData = getLocale(key);
              if (newLocaleData != null) {
                  this._locale = newLocaleData;
              }
              return this;
          }
      }

      var lang = deprecate(
          'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
          function (key) {
              if (key === undefined) {
                  return this.localeData();
              } else {
                  return this.locale(key);
              }
          }
      );

      function localeData () {
          return this._locale;
      }

      var MS_PER_SECOND = 1000;
      var MS_PER_MINUTE = 60 * MS_PER_SECOND;
      var MS_PER_HOUR = 60 * MS_PER_MINUTE;
      var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

      // actual modulo - handles negative numbers (for dates before 1970):
      function mod$1(dividend, divisor) {
          return (dividend % divisor + divisor) % divisor;
      }

      function localStartOfDate(y, m, d) {
          // the date constructor remaps years 0-99 to 1900-1999
          if (y < 100 && y >= 0) {
              // preserve leap years using a full 400 year cycle, then reset
              return new Date(y + 400, m, d) - MS_PER_400_YEARS;
          } else {
              return new Date(y, m, d).valueOf();
          }
      }

      function utcStartOfDate(y, m, d) {
          // Date.UTC remaps years 0-99 to 1900-1999
          if (y < 100 && y >= 0) {
              // preserve leap years using a full 400 year cycle, then reset
              return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
          } else {
              return Date.UTC(y, m, d);
          }
      }

      function startOf (units) {
          var time;
          units = normalizeUnits(units);
          if (units === undefined || units === 'millisecond' || !this.isValid()) {
              return this;
          }

          var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

          switch (units) {
              case 'year':
                  time = startOfDate(this.year(), 0, 1);
                  break;
              case 'quarter':
                  time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                  break;
              case 'month':
                  time = startOfDate(this.year(), this.month(), 1);
                  break;
              case 'week':
                  time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                  break;
              case 'isoWeek':
                  time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                  break;
              case 'day':
              case 'date':
                  time = startOfDate(this.year(), this.month(), this.date());
                  break;
              case 'hour':
                  time = this._d.valueOf();
                  time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                  break;
              case 'minute':
                  time = this._d.valueOf();
                  time -= mod$1(time, MS_PER_MINUTE);
                  break;
              case 'second':
                  time = this._d.valueOf();
                  time -= mod$1(time, MS_PER_SECOND);
                  break;
          }

          this._d.setTime(time);
          hooks.updateOffset(this, true);
          return this;
      }

      function endOf (units) {
          var time;
          units = normalizeUnits(units);
          if (units === undefined || units === 'millisecond' || !this.isValid()) {
              return this;
          }

          var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

          switch (units) {
              case 'year':
                  time = startOfDate(this.year() + 1, 0, 1) - 1;
                  break;
              case 'quarter':
                  time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                  break;
              case 'month':
                  time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                  break;
              case 'week':
                  time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                  break;
              case 'isoWeek':
                  time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                  break;
              case 'day':
              case 'date':
                  time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                  break;
              case 'hour':
                  time = this._d.valueOf();
                  time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                  break;
              case 'minute':
                  time = this._d.valueOf();
                  time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                  break;
              case 'second':
                  time = this._d.valueOf();
                  time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                  break;
          }

          this._d.setTime(time);
          hooks.updateOffset(this, true);
          return this;
      }

      function valueOf () {
          return this._d.valueOf() - ((this._offset || 0) * 60000);
      }

      function unix () {
          return Math.floor(this.valueOf() / 1000);
      }

      function toDate () {
          return new Date(this.valueOf());
      }

      function toArray () {
          var m = this;
          return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
      }

      function toObject () {
          var m = this;
          return {
              years: m.year(),
              months: m.month(),
              date: m.date(),
              hours: m.hours(),
              minutes: m.minutes(),
              seconds: m.seconds(),
              milliseconds: m.milliseconds()
          };
      }

      function toJSON () {
          // new Date(NaN).toJSON() === null
          return this.isValid() ? this.toISOString() : null;
      }

      function isValid$2 () {
          return isValid(this);
      }

      function parsingFlags () {
          return extend({}, getParsingFlags(this));
      }

      function invalidAt () {
          return getParsingFlags(this).overflow;
      }

      function creationData() {
          return {
              input: this._i,
              format: this._f,
              locale: this._locale,
              isUTC: this._isUTC,
              strict: this._strict
          };
      }

      // FORMATTING

      addFormatToken(0, ['gg', 2], 0, function () {
          return this.weekYear() % 100;
      });

      addFormatToken(0, ['GG', 2], 0, function () {
          return this.isoWeekYear() % 100;
      });

      function addWeekYearFormatToken (token, getter) {
          addFormatToken(0, [token, token.length], 0, getter);
      }

      addWeekYearFormatToken('gggg',     'weekYear');
      addWeekYearFormatToken('ggggg',    'weekYear');
      addWeekYearFormatToken('GGGG',  'isoWeekYear');
      addWeekYearFormatToken('GGGGG', 'isoWeekYear');

      // ALIASES

      addUnitAlias('weekYear', 'gg');
      addUnitAlias('isoWeekYear', 'GG');

      // PRIORITY

      addUnitPriority('weekYear', 1);
      addUnitPriority('isoWeekYear', 1);


      // PARSING

      addRegexToken('G',      matchSigned);
      addRegexToken('g',      matchSigned);
      addRegexToken('GG',     match1to2, match2);
      addRegexToken('gg',     match1to2, match2);
      addRegexToken('GGGG',   match1to4, match4);
      addRegexToken('gggg',   match1to4, match4);
      addRegexToken('GGGGG',  match1to6, match6);
      addRegexToken('ggggg',  match1to6, match6);

      addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
          week[token.substr(0, 2)] = toInt(input);
      });

      addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
          week[token] = hooks.parseTwoDigitYear(input);
      });

      // MOMENTS

      function getSetWeekYear (input) {
          return getSetWeekYearHelper.call(this,
                  input,
                  this.week(),
                  this.weekday(),
                  this.localeData()._week.dow,
                  this.localeData()._week.doy);
      }

      function getSetISOWeekYear (input) {
          return getSetWeekYearHelper.call(this,
                  input, this.isoWeek(), this.isoWeekday(), 1, 4);
      }

      function getISOWeeksInYear () {
          return weeksInYear(this.year(), 1, 4);
      }

      function getWeeksInYear () {
          var weekInfo = this.localeData()._week;
          return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
      }

      function getSetWeekYearHelper(input, week, weekday, dow, doy) {
          var weeksTarget;
          if (input == null) {
              return weekOfYear(this, dow, doy).year;
          } else {
              weeksTarget = weeksInYear(input, dow, doy);
              if (week > weeksTarget) {
                  week = weeksTarget;
              }
              return setWeekAll.call(this, input, week, weekday, dow, doy);
          }
      }

      function setWeekAll(weekYear, week, weekday, dow, doy) {
          var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
              date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

          this.year(date.getUTCFullYear());
          this.month(date.getUTCMonth());
          this.date(date.getUTCDate());
          return this;
      }

      // FORMATTING

      addFormatToken('Q', 0, 'Qo', 'quarter');

      // ALIASES

      addUnitAlias('quarter', 'Q');

      // PRIORITY

      addUnitPriority('quarter', 7);

      // PARSING

      addRegexToken('Q', match1);
      addParseToken('Q', function (input, array) {
          array[MONTH] = (toInt(input) - 1) * 3;
      });

      // MOMENTS

      function getSetQuarter (input) {
          return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
      }

      // FORMATTING

      addFormatToken('D', ['DD', 2], 'Do', 'date');

      // ALIASES

      addUnitAlias('date', 'D');

      // PRIORITY
      addUnitPriority('date', 9);

      // PARSING

      addRegexToken('D',  match1to2);
      addRegexToken('DD', match1to2, match2);
      addRegexToken('Do', function (isStrict, locale) {
          // TODO: Remove "ordinalParse" fallback in next major release.
          return isStrict ?
            (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
            locale._dayOfMonthOrdinalParseLenient;
      });

      addParseToken(['D', 'DD'], DATE);
      addParseToken('Do', function (input, array) {
          array[DATE] = toInt(input.match(match1to2)[0]);
      });

      // MOMENTS

      var getSetDayOfMonth = makeGetSet('Date', true);

      // FORMATTING

      addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

      // ALIASES

      addUnitAlias('dayOfYear', 'DDD');

      // PRIORITY
      addUnitPriority('dayOfYear', 4);

      // PARSING

      addRegexToken('DDD',  match1to3);
      addRegexToken('DDDD', match3);
      addParseToken(['DDD', 'DDDD'], function (input, array, config) {
          config._dayOfYear = toInt(input);
      });

      // HELPERS

      // MOMENTS

      function getSetDayOfYear (input) {
          var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
          return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
      }

      // FORMATTING

      addFormatToken('m', ['mm', 2], 0, 'minute');

      // ALIASES

      addUnitAlias('minute', 'm');

      // PRIORITY

      addUnitPriority('minute', 14);

      // PARSING

      addRegexToken('m',  match1to2);
      addRegexToken('mm', match1to2, match2);
      addParseToken(['m', 'mm'], MINUTE);

      // MOMENTS

      var getSetMinute = makeGetSet('Minutes', false);

      // FORMATTING

      addFormatToken('s', ['ss', 2], 0, 'second');

      // ALIASES

      addUnitAlias('second', 's');

      // PRIORITY

      addUnitPriority('second', 15);

      // PARSING

      addRegexToken('s',  match1to2);
      addRegexToken('ss', match1to2, match2);
      addParseToken(['s', 'ss'], SECOND);

      // MOMENTS

      var getSetSecond = makeGetSet('Seconds', false);

      // FORMATTING

      addFormatToken('S', 0, 0, function () {
          return ~~(this.millisecond() / 100);
      });

      addFormatToken(0, ['SS', 2], 0, function () {
          return ~~(this.millisecond() / 10);
      });

      addFormatToken(0, ['SSS', 3], 0, 'millisecond');
      addFormatToken(0, ['SSSS', 4], 0, function () {
          return this.millisecond() * 10;
      });
      addFormatToken(0, ['SSSSS', 5], 0, function () {
          return this.millisecond() * 100;
      });
      addFormatToken(0, ['SSSSSS', 6], 0, function () {
          return this.millisecond() * 1000;
      });
      addFormatToken(0, ['SSSSSSS', 7], 0, function () {
          return this.millisecond() * 10000;
      });
      addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
          return this.millisecond() * 100000;
      });
      addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
          return this.millisecond() * 1000000;
      });


      // ALIASES

      addUnitAlias('millisecond', 'ms');

      // PRIORITY

      addUnitPriority('millisecond', 16);

      // PARSING

      addRegexToken('S',    match1to3, match1);
      addRegexToken('SS',   match1to3, match2);
      addRegexToken('SSS',  match1to3, match3);

      var token;
      for (token = 'SSSS'; token.length <= 9; token += 'S') {
          addRegexToken(token, matchUnsigned);
      }

      function parseMs(input, array) {
          array[MILLISECOND] = toInt(('0.' + input) * 1000);
      }

      for (token = 'S'; token.length <= 9; token += 'S') {
          addParseToken(token, parseMs);
      }
      // MOMENTS

      var getSetMillisecond = makeGetSet('Milliseconds', false);

      // FORMATTING

      addFormatToken('z',  0, 0, 'zoneAbbr');
      addFormatToken('zz', 0, 0, 'zoneName');

      // MOMENTS

      function getZoneAbbr () {
          return this._isUTC ? 'UTC' : '';
      }

      function getZoneName () {
          return this._isUTC ? 'Coordinated Universal Time' : '';
      }

      var proto = Moment.prototype;

      proto.add               = add;
      proto.calendar          = calendar$1;
      proto.clone             = clone;
      proto.diff              = diff;
      proto.endOf             = endOf;
      proto.format            = format;
      proto.from              = from;
      proto.fromNow           = fromNow;
      proto.to                = to;
      proto.toNow             = toNow;
      proto.get               = stringGet;
      proto.invalidAt         = invalidAt;
      proto.isAfter           = isAfter;
      proto.isBefore          = isBefore;
      proto.isBetween         = isBetween;
      proto.isSame            = isSame;
      proto.isSameOrAfter     = isSameOrAfter;
      proto.isSameOrBefore    = isSameOrBefore;
      proto.isValid           = isValid$2;
      proto.lang              = lang;
      proto.locale            = locale;
      proto.localeData        = localeData;
      proto.max               = prototypeMax;
      proto.min               = prototypeMin;
      proto.parsingFlags      = parsingFlags;
      proto.set               = stringSet;
      proto.startOf           = startOf;
      proto.subtract          = subtract;
      proto.toArray           = toArray;
      proto.toObject          = toObject;
      proto.toDate            = toDate;
      proto.toISOString       = toISOString;
      proto.inspect           = inspect;
      proto.toJSON            = toJSON;
      proto.toString          = toString;
      proto.unix              = unix;
      proto.valueOf           = valueOf;
      proto.creationData      = creationData;
      proto.year       = getSetYear;
      proto.isLeapYear = getIsLeapYear;
      proto.weekYear    = getSetWeekYear;
      proto.isoWeekYear = getSetISOWeekYear;
      proto.quarter = proto.quarters = getSetQuarter;
      proto.month       = getSetMonth;
      proto.daysInMonth = getDaysInMonth;
      proto.week           = proto.weeks        = getSetWeek;
      proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
      proto.weeksInYear    = getWeeksInYear;
      proto.isoWeeksInYear = getISOWeeksInYear;
      proto.date       = getSetDayOfMonth;
      proto.day        = proto.days             = getSetDayOfWeek;
      proto.weekday    = getSetLocaleDayOfWeek;
      proto.isoWeekday = getSetISODayOfWeek;
      proto.dayOfYear  = getSetDayOfYear;
      proto.hour = proto.hours = getSetHour;
      proto.minute = proto.minutes = getSetMinute;
      proto.second = proto.seconds = getSetSecond;
      proto.millisecond = proto.milliseconds = getSetMillisecond;
      proto.utcOffset            = getSetOffset;
      proto.utc                  = setOffsetToUTC;
      proto.local                = setOffsetToLocal;
      proto.parseZone            = setOffsetToParsedOffset;
      proto.hasAlignedHourOffset = hasAlignedHourOffset;
      proto.isDST                = isDaylightSavingTime;
      proto.isLocal              = isLocal;
      proto.isUtcOffset          = isUtcOffset;
      proto.isUtc                = isUtc;
      proto.isUTC                = isUtc;
      proto.zoneAbbr = getZoneAbbr;
      proto.zoneName = getZoneName;
      proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
      proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
      proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
      proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
      proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

      function createUnix (input) {
          return createLocal(input * 1000);
      }

      function createInZone () {
          return createLocal.apply(null, arguments).parseZone();
      }

      function preParsePostFormat (string) {
          return string;
      }

      var proto$1 = Locale.prototype;

      proto$1.calendar        = calendar;
      proto$1.longDateFormat  = longDateFormat;
      proto$1.invalidDate     = invalidDate;
      proto$1.ordinal         = ordinal;
      proto$1.preparse        = preParsePostFormat;
      proto$1.postformat      = preParsePostFormat;
      proto$1.relativeTime    = relativeTime;
      proto$1.pastFuture      = pastFuture;
      proto$1.set             = set;

      proto$1.months            =        localeMonths;
      proto$1.monthsShort       =        localeMonthsShort;
      proto$1.monthsParse       =        localeMonthsParse;
      proto$1.monthsRegex       = monthsRegex;
      proto$1.monthsShortRegex  = monthsShortRegex;
      proto$1.week = localeWeek;
      proto$1.firstDayOfYear = localeFirstDayOfYear;
      proto$1.firstDayOfWeek = localeFirstDayOfWeek;

      proto$1.weekdays       =        localeWeekdays;
      proto$1.weekdaysMin    =        localeWeekdaysMin;
      proto$1.weekdaysShort  =        localeWeekdaysShort;
      proto$1.weekdaysParse  =        localeWeekdaysParse;

      proto$1.weekdaysRegex       =        weekdaysRegex;
      proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
      proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

      proto$1.isPM = localeIsPM;
      proto$1.meridiem = localeMeridiem;

      function get$1 (format, index, field, setter) {
          var locale = getLocale();
          var utc = createUTC().set(setter, index);
          return locale[field](utc, format);
      }

      function listMonthsImpl (format, index, field) {
          if (isNumber(format)) {
              index = format;
              format = undefined;
          }

          format = format || '';

          if (index != null) {
              return get$1(format, index, field, 'month');
          }

          var i;
          var out = [];
          for (i = 0; i < 12; i++) {
              out[i] = get$1(format, i, field, 'month');
          }
          return out;
      }

      // ()
      // (5)
      // (fmt, 5)
      // (fmt)
      // (true)
      // (true, 5)
      // (true, fmt, 5)
      // (true, fmt)
      function listWeekdaysImpl (localeSorted, format, index, field) {
          if (typeof localeSorted === 'boolean') {
              if (isNumber(format)) {
                  index = format;
                  format = undefined;
              }

              format = format || '';
          } else {
              format = localeSorted;
              index = format;
              localeSorted = false;

              if (isNumber(format)) {
                  index = format;
                  format = undefined;
              }

              format = format || '';
          }

          var locale = getLocale(),
              shift = localeSorted ? locale._week.dow : 0;

          if (index != null) {
              return get$1(format, (index + shift) % 7, field, 'day');
          }

          var i;
          var out = [];
          for (i = 0; i < 7; i++) {
              out[i] = get$1(format, (i + shift) % 7, field, 'day');
          }
          return out;
      }

      function listMonths (format, index) {
          return listMonthsImpl(format, index, 'months');
      }

      function listMonthsShort (format, index) {
          return listMonthsImpl(format, index, 'monthsShort');
      }

      function listWeekdays (localeSorted, format, index) {
          return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
      }

      function listWeekdaysShort (localeSorted, format, index) {
          return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
      }

      function listWeekdaysMin (localeSorted, format, index) {
          return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
      }

      getSetGlobalLocale('en', {
          dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
          ordinal : function (number) {
              var b = number % 10,
                  output = (toInt(number % 100 / 10) === 1) ? 'th' :
                  (b === 1) ? 'st' :
                  (b === 2) ? 'nd' :
                  (b === 3) ? 'rd' : 'th';
              return number + output;
          }
      });

      // Side effect imports

      hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
      hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

      var mathAbs = Math.abs;

      function abs () {
          var data           = this._data;

          this._milliseconds = mathAbs(this._milliseconds);
          this._days         = mathAbs(this._days);
          this._months       = mathAbs(this._months);

          data.milliseconds  = mathAbs(data.milliseconds);
          data.seconds       = mathAbs(data.seconds);
          data.minutes       = mathAbs(data.minutes);
          data.hours         = mathAbs(data.hours);
          data.months        = mathAbs(data.months);
          data.years         = mathAbs(data.years);

          return this;
      }

      function addSubtract$1 (duration, input, value, direction) {
          var other = createDuration(input, value);

          duration._milliseconds += direction * other._milliseconds;
          duration._days         += direction * other._days;
          duration._months       += direction * other._months;

          return duration._bubble();
      }

      // supports only 2.0-style add(1, 's') or add(duration)
      function add$1 (input, value) {
          return addSubtract$1(this, input, value, 1);
      }

      // supports only 2.0-style subtract(1, 's') or subtract(duration)
      function subtract$1 (input, value) {
          return addSubtract$1(this, input, value, -1);
      }

      function absCeil (number) {
          if (number < 0) {
              return Math.floor(number);
          } else {
              return Math.ceil(number);
          }
      }

      function bubble () {
          var milliseconds = this._milliseconds;
          var days         = this._days;
          var months       = this._months;
          var data         = this._data;
          var seconds, minutes, hours, years, monthsFromDays;

          // if we have a mix of positive and negative values, bubble down first
          // check: https://github.com/moment/moment/issues/2166
          if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                  (milliseconds <= 0 && days <= 0 && months <= 0))) {
              milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
              days = 0;
              months = 0;
          }

          // The following code bubbles up values, see the tests for
          // examples of what that means.
          data.milliseconds = milliseconds % 1000;

          seconds           = absFloor(milliseconds / 1000);
          data.seconds      = seconds % 60;

          minutes           = absFloor(seconds / 60);
          data.minutes      = minutes % 60;

          hours             = absFloor(minutes / 60);
          data.hours        = hours % 24;

          days += absFloor(hours / 24);

          // convert days to months
          monthsFromDays = absFloor(daysToMonths(days));
          months += monthsFromDays;
          days -= absCeil(monthsToDays(monthsFromDays));

          // 12 months -> 1 year
          years = absFloor(months / 12);
          months %= 12;

          data.days   = days;
          data.months = months;
          data.years  = years;

          return this;
      }

      function daysToMonths (days) {
          // 400 years have 146097 days (taking into account leap year rules)
          // 400 years have 12 months === 4800
          return days * 4800 / 146097;
      }

      function monthsToDays (months) {
          // the reverse of daysToMonths
          return months * 146097 / 4800;
      }

      function as (units) {
          if (!this.isValid()) {
              return NaN;
          }
          var days;
          var months;
          var milliseconds = this._milliseconds;

          units = normalizeUnits(units);

          if (units === 'month' || units === 'quarter' || units === 'year') {
              days = this._days + milliseconds / 864e5;
              months = this._months + daysToMonths(days);
              switch (units) {
                  case 'month':   return months;
                  case 'quarter': return months / 3;
                  case 'year':    return months / 12;
              }
          } else {
              // handle milliseconds separately because of floating point math errors (issue #1867)
              days = this._days + Math.round(monthsToDays(this._months));
              switch (units) {
                  case 'week'   : return days / 7     + milliseconds / 6048e5;
                  case 'day'    : return days         + milliseconds / 864e5;
                  case 'hour'   : return days * 24    + milliseconds / 36e5;
                  case 'minute' : return days * 1440  + milliseconds / 6e4;
                  case 'second' : return days * 86400 + milliseconds / 1000;
                  // Math.floor prevents floating point math errors here
                  case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                  default: throw new Error('Unknown unit ' + units);
              }
          }
      }

      // TODO: Use this.as('ms')?
      function valueOf$1 () {
          if (!this.isValid()) {
              return NaN;
          }
          return (
              this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6
          );
      }

      function makeAs (alias) {
          return function () {
              return this.as(alias);
          };
      }

      var asMilliseconds = makeAs('ms');
      var asSeconds      = makeAs('s');
      var asMinutes      = makeAs('m');
      var asHours        = makeAs('h');
      var asDays         = makeAs('d');
      var asWeeks        = makeAs('w');
      var asMonths       = makeAs('M');
      var asQuarters     = makeAs('Q');
      var asYears        = makeAs('y');

      function clone$1 () {
          return createDuration(this);
      }

      function get$2 (units) {
          units = normalizeUnits(units);
          return this.isValid() ? this[units + 's']() : NaN;
      }

      function makeGetter(name) {
          return function () {
              return this.isValid() ? this._data[name] : NaN;
          };
      }

      var milliseconds = makeGetter('milliseconds');
      var seconds      = makeGetter('seconds');
      var minutes      = makeGetter('minutes');
      var hours        = makeGetter('hours');
      var days         = makeGetter('days');
      var months       = makeGetter('months');
      var years        = makeGetter('years');

      function weeks () {
          return absFloor(this.days() / 7);
      }

      var round = Math.round;
      var thresholds = {
          ss: 44,         // a few seconds to seconds
          s : 45,         // seconds to minute
          m : 45,         // minutes to hour
          h : 22,         // hours to day
          d : 26,         // days to month
          M : 11          // months to year
      };

      // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
      function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
          return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
      }

      function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
          var duration = createDuration(posNegDuration).abs();
          var seconds  = round(duration.as('s'));
          var minutes  = round(duration.as('m'));
          var hours    = round(duration.as('h'));
          var days     = round(duration.as('d'));
          var months   = round(duration.as('M'));
          var years    = round(duration.as('y'));

          var a = seconds <= thresholds.ss && ['s', seconds]  ||
                  seconds < thresholds.s   && ['ss', seconds] ||
                  minutes <= 1             && ['m']           ||
                  minutes < thresholds.m   && ['mm', minutes] ||
                  hours   <= 1             && ['h']           ||
                  hours   < thresholds.h   && ['hh', hours]   ||
                  days    <= 1             && ['d']           ||
                  days    < thresholds.d   && ['dd', days]    ||
                  months  <= 1             && ['M']           ||
                  months  < thresholds.M   && ['MM', months]  ||
                  years   <= 1             && ['y']           || ['yy', years];

          a[2] = withoutSuffix;
          a[3] = +posNegDuration > 0;
          a[4] = locale;
          return substituteTimeAgo.apply(null, a);
      }

      // This function allows you to set the rounding function for relative time strings
      function getSetRelativeTimeRounding (roundingFunction) {
          if (roundingFunction === undefined) {
              return round;
          }
          if (typeof(roundingFunction) === 'function') {
              round = roundingFunction;
              return true;
          }
          return false;
      }

      // This function allows you to set a threshold for relative time strings
      function getSetRelativeTimeThreshold (threshold, limit) {
          if (thresholds[threshold] === undefined) {
              return false;
          }
          if (limit === undefined) {
              return thresholds[threshold];
          }
          thresholds[threshold] = limit;
          if (threshold === 's') {
              thresholds.ss = limit - 1;
          }
          return true;
      }

      function humanize (withSuffix) {
          if (!this.isValid()) {
              return this.localeData().invalidDate();
          }

          var locale = this.localeData();
          var output = relativeTime$1(this, !withSuffix, locale);

          if (withSuffix) {
              output = locale.pastFuture(+this, output);
          }

          return locale.postformat(output);
      }

      var abs$1 = Math.abs;

      function sign(x) {
          return ((x > 0) - (x < 0)) || +x;
      }

      function toISOString$1() {
          // for ISO strings we do not use the normal bubbling rules:
          //  * milliseconds bubble up until they become hours
          //  * days do not bubble at all
          //  * months bubble up until they become years
          // This is because there is no context-free conversion between hours and days
          // (think of clock changes)
          // and also not between days and months (28-31 days per month)
          if (!this.isValid()) {
              return this.localeData().invalidDate();
          }

          var seconds = abs$1(this._milliseconds) / 1000;
          var days         = abs$1(this._days);
          var months       = abs$1(this._months);
          var minutes, hours, years;

          // 3600 seconds -> 60 minutes -> 1 hour
          minutes           = absFloor(seconds / 60);
          hours             = absFloor(minutes / 60);
          seconds %= 60;
          minutes %= 60;

          // 12 months -> 1 year
          years  = absFloor(months / 12);
          months %= 12;


          // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
          var Y = years;
          var M = months;
          var D = days;
          var h = hours;
          var m = minutes;
          var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
          var total = this.asSeconds();

          if (!total) {
              // this is the same as C#'s (Noda) and python (isodate)...
              // but not other JS (goog.date)
              return 'P0D';
          }

          var totalSign = total < 0 ? '-' : '';
          var ymSign = sign(this._months) !== sign(total) ? '-' : '';
          var daysSign = sign(this._days) !== sign(total) ? '-' : '';
          var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

          return totalSign + 'P' +
              (Y ? ymSign + Y + 'Y' : '') +
              (M ? ymSign + M + 'M' : '') +
              (D ? daysSign + D + 'D' : '') +
              ((h || m || s) ? 'T' : '') +
              (h ? hmsSign + h + 'H' : '') +
              (m ? hmsSign + m + 'M' : '') +
              (s ? hmsSign + s + 'S' : '');
      }

      var proto$2 = Duration.prototype;

      proto$2.isValid        = isValid$1;
      proto$2.abs            = abs;
      proto$2.add            = add$1;
      proto$2.subtract       = subtract$1;
      proto$2.as             = as;
      proto$2.asMilliseconds = asMilliseconds;
      proto$2.asSeconds      = asSeconds;
      proto$2.asMinutes      = asMinutes;
      proto$2.asHours        = asHours;
      proto$2.asDays         = asDays;
      proto$2.asWeeks        = asWeeks;
      proto$2.asMonths       = asMonths;
      proto$2.asQuarters     = asQuarters;
      proto$2.asYears        = asYears;
      proto$2.valueOf        = valueOf$1;
      proto$2._bubble        = bubble;
      proto$2.clone          = clone$1;
      proto$2.get            = get$2;
      proto$2.milliseconds   = milliseconds;
      proto$2.seconds        = seconds;
      proto$2.minutes        = minutes;
      proto$2.hours          = hours;
      proto$2.days           = days;
      proto$2.weeks          = weeks;
      proto$2.months         = months;
      proto$2.years          = years;
      proto$2.humanize       = humanize;
      proto$2.toISOString    = toISOString$1;
      proto$2.toString       = toISOString$1;
      proto$2.toJSON         = toISOString$1;
      proto$2.locale         = locale;
      proto$2.localeData     = localeData;

      proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
      proto$2.lang = lang;

      // Side effect imports

      // FORMATTING

      addFormatToken('X', 0, 0, 'unix');
      addFormatToken('x', 0, 0, 'valueOf');

      // PARSING

      addRegexToken('x', matchSigned);
      addRegexToken('X', matchTimestamp);
      addParseToken('X', function (input, array, config) {
          config._d = new Date(parseFloat(input, 10) * 1000);
      });
      addParseToken('x', function (input, array, config) {
          config._d = new Date(toInt(input));
      });

      // Side effect imports


      hooks.version = '2.24.0';

      setHookCallback(createLocal);

      hooks.fn                    = proto;
      hooks.min                   = min;
      hooks.max                   = max;
      hooks.now                   = now;
      hooks.utc                   = createUTC;
      hooks.unix                  = createUnix;
      hooks.months                = listMonths;
      hooks.isDate                = isDate;
      hooks.locale                = getSetGlobalLocale;
      hooks.invalid               = createInvalid;
      hooks.duration              = createDuration;
      hooks.isMoment              = isMoment;
      hooks.weekdays              = listWeekdays;
      hooks.parseZone             = createInZone;
      hooks.localeData            = getLocale;
      hooks.isDuration            = isDuration;
      hooks.monthsShort           = listMonthsShort;
      hooks.weekdaysMin           = listWeekdaysMin;
      hooks.defineLocale          = defineLocale;
      hooks.updateLocale          = updateLocale;
      hooks.locales               = listLocales;
      hooks.weekdaysShort         = listWeekdaysShort;
      hooks.normalizeUnits        = normalizeUnits;
      hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
      hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
      hooks.calendarFormat        = getCalendarFormat;
      hooks.prototype             = proto;

      // currently HTML5 input type only supports 24-hour formats
      hooks.HTML5_FMT = {
          DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
          DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
          DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
          DATE: 'YYYY-MM-DD',                             // <input type="date" />
          TIME: 'HH:mm',                                  // <input type="time" />
          TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
          TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
          WEEK: 'GGGG-[W]WW',                             // <input type="week" />
          MONTH: 'YYYY-MM'                                // <input type="month" />
      };

      return hooks;

  })));
  });

  riot$1.tag2('article_widget_view', '<div class="article-meta" if="{article !== null}"> <a href="{⁗#/profile/⁗ + article.author.username}"><img riot-src="{article.author.image}"></a> <div class="info"> <a href="{⁗#/profile/⁗ + article.author.username}" class="author">{article.author.username}</a> <span class="date">{formattedDate( article.createdAt )}</span> </div> <virtual if="{isOwnArticle() == false}"> <button onclick="{didFollowHandler}" class="{btn: true, btn-sm: true, btn-secondary: article.author.following, btn-outline-secondary: !article.author.following}"> <i class="ion-plus-round"></i>&nbsp; {(article.author.following ? ⁗Unfollow⁗ : ⁗Follow⁗) + ⁗ ⁗ + article.author.username} </button> &nbsp;&nbsp; <button onclick="{didFavoriteHandler}" class="{btn: true, btn-sm: true, btn-primary: article.favorited,  btn-outline-primary: !(article.favorited)}"> <i class="ion-heart"></i>&nbsp; {(article.favorited ? ⁗Unfavorite⁗ : ⁗Favorite⁗) + ⁗ Article⁗} <span class="counter">({article.favoritesCount})</span> </button> </virtual> <virtual if="{isOwnArticle()}"> <button onclick="{didEditingHandler}" class="btn btn-sm btn-outline-secondary"> <i class="ion-edit"></i>&nbsp;Edit Article </button> &nbsp;&nbsp; <button onclick="{didDeleteHandler}" class="btn btn-sm btn-outline-danger"> <i class="ion-trash-a"></i>&nbsp;Delete Article </button> </virtual> </div>', '', '', function(opts) {
  var self = this;
  self.article = null;
  self.loggedUserProfile = null;

  self.didFollowHandler  = () => {};
  self.didFavoriteHandler  = () => {};
  self.didEditingHandler = () => {};
  self.didDeleteHandler  = () => {};

  self.setArticle = ( article ) => {
      self.article = article;
      self.update();
  };
  self.formattedDate = ( date ) => {
      return moment( date ).format("MMMM DD, YYYY")
  };

  self.isOwnArticle = () =>{
      let profile = self.loggedUserProfile;
      let article = self.article;
      if ( profile === null || article === null ) return false
      return profile.username === article.author.username
  };

  });

  var marked = createCommonjsModule(function (module, exports) {
  (function(root) {

  /**
   * Block-Level Grammar
   */

  var block = {
    newline: /^\n+/,
    code: /^( {4}[^\n]+\n*)+/,
    fences: /^ {0,3}(`{3,}|~{3,})([^`~\n]*)\n(?:|([\s\S]*?)\n)(?: {0,3}\1[~`]* *(?:\n+|$)|$)/,
    hr: /^ {0,3}((?:- *){3,}|(?:_ *){3,}|(?:\* *){3,})(?:\n+|$)/,
    heading: /^ {0,3}(#{1,6}) +([^\n]*?)(?: +#+)? *(?:\n+|$)/,
    blockquote: /^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/,
    list: /^( {0,3})(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
    html: '^ {0,3}(?:' // optional indentation
      + '<(script|pre|style)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)' // (1)
      + '|comment[^\\n]*(\\n+|$)' // (2)
      + '|<\\?[\\s\\S]*?\\?>\\n*' // (3)
      + '|<![A-Z][\\s\\S]*?>\\n*' // (4)
      + '|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>\\n*' // (5)
      + '|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:\\n{2,}|$)' // (6)
      + '|<(?!script|pre|style)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:\\n{2,}|$)' // (7) open tag
      + '|</(?!script|pre|style)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:\\n{2,}|$)' // (7) closing tag
      + ')',
    def: /^ {0,3}\[(label)\]: *\n? *<?([^\s>]+)>?(?:(?: +\n? *| *\n *)(title))? *(?:\n+|$)/,
    nptable: noop,
    table: noop,
    lheading: /^([^\n]+)\n {0,3}(=+|-+) *(?:\n+|$)/,
    // regex template, placeholders will be replaced according to different paragraph
    // interruption rules of commonmark and the original markdown spec:
    _paragraph: /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html)[^\n]+)*)/,
    text: /^[^\n]+/
  };

  block._label = /(?!\s*\])(?:\\[\[\]]|[^\[\]])+/;
  block._title = /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/;
  block.def = edit(block.def)
    .replace('label', block._label)
    .replace('title', block._title)
    .getRegex();

  block.bullet = /(?:[*+-]|\d{1,9}\.)/;
  block.item = /^( *)(bull) ?[^\n]*(?:\n(?!\1bull ?)[^\n]*)*/;
  block.item = edit(block.item, 'gm')
    .replace(/bull/g, block.bullet)
    .getRegex();

  block.list = edit(block.list)
    .replace(/bull/g, block.bullet)
    .replace('hr', '\\n+(?=\\1?(?:(?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$))')
    .replace('def', '\\n+(?=' + block.def.source + ')')
    .getRegex();

  block._tag = 'address|article|aside|base|basefont|blockquote|body|caption'
    + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption'
    + '|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe'
    + '|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option'
    + '|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr'
    + '|track|ul';
  block._comment = /<!--(?!-?>)[\s\S]*?-->/;
  block.html = edit(block.html, 'i')
    .replace('comment', block._comment)
    .replace('tag', block._tag)
    .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
    .getRegex();

  block.paragraph = edit(block._paragraph)
    .replace('hr', block.hr)
    .replace('heading', ' {0,3}#{1,6} +')
    .replace('|lheading', '') // setex headings don't interrupt commonmark paragraphs
    .replace('blockquote', ' {0,3}>')
    .replace('fences', ' {0,3}(?:`{3,}|~{3,})[^`\\n]*\\n')
    .replace('list', ' {0,3}(?:[*+-]|1[.)]) ') // only lists starting from 1 can interrupt
    .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|!--)')
    .replace('tag', block._tag) // pars can be interrupted by type (6) html blocks
    .getRegex();

  block.blockquote = edit(block.blockquote)
    .replace('paragraph', block.paragraph)
    .getRegex();

  /**
   * Normal Block Grammar
   */

  block.normal = merge({}, block);

  /**
   * GFM Block Grammar
   */

  block.gfm = merge({}, block.normal, {
    nptable: /^ *([^|\n ].*\|.*)\n *([-:]+ *\|[-| :]*)(?:\n((?:.*[^>\n ].*(?:\n|$))*)\n*|$)/,
    table: /^ *\|(.+)\n *\|?( *[-:]+[-| :]*)(?:\n((?: *[^>\n ].*(?:\n|$))*)\n*|$)/
  });

  /**
   * Pedantic grammar (original John Gruber's loose markdown specification)
   */

  block.pedantic = merge({}, block.normal, {
    html: edit(
      '^ *(?:comment *(?:\\n|\\s*$)'
      + '|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)' // closed tag
      + '|<tag(?:"[^"]*"|\'[^\']*\'|\\s[^\'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))')
      .replace('comment', block._comment)
      .replace(/tag/g, '(?!(?:'
        + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub'
        + '|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)'
        + '\\b)\\w+(?!:|[^\\w\\s@]*@)\\b')
      .getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^ *(#{1,6}) *([^\n]+?) *(?:#+ *)?(?:\n+|$)/,
    fences: noop, // fences not supported
    paragraph: edit(block.normal._paragraph)
      .replace('hr', block.hr)
      .replace('heading', ' *#{1,6} *[^\n]')
      .replace('lheading', block.lheading)
      .replace('blockquote', ' {0,3}>')
      .replace('|fences', '')
      .replace('|list', '')
      .replace('|html', '')
      .getRegex()
  });

  /**
   * Block Lexer
   */

  function Lexer(options) {
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.options = options || marked.defaults;
    this.rules = block.normal;

    if (this.options.pedantic) {
      this.rules = block.pedantic;
    } else if (this.options.gfm) {
      this.rules = block.gfm;
    }
  }

  /**
   * Expose Block Rules
   */

  Lexer.rules = block;

  /**
   * Static Lex Method
   */

  Lexer.lex = function(src, options) {
    var lexer = new Lexer(options);
    return lexer.lex(src);
  };

  /**
   * Preprocessing
   */

  Lexer.prototype.lex = function(src) {
    src = src
      .replace(/\r\n|\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\u00a0/g, ' ')
      .replace(/\u2424/g, '\n');

    return this.token(src, true);
  };

  /**
   * Lexing
   */

  Lexer.prototype.token = function(src, top) {
    src = src.replace(/^ +$/gm, '');
    var next,
        loose,
        cap,
        bull,
        b,
        item,
        listStart,
        listItems,
        t,
        space,
        i,
        tag,
        l,
        isordered,
        istask,
        ischecked;

    while (src) {
      // newline
      if (cap = this.rules.newline.exec(src)) {
        src = src.substring(cap[0].length);
        if (cap[0].length > 1) {
          this.tokens.push({
            type: 'space'
          });
        }
      }

      // code
      if (cap = this.rules.code.exec(src)) {
        var lastToken = this.tokens[this.tokens.length - 1];
        src = src.substring(cap[0].length);
        // An indented code block cannot interrupt a paragraph.
        if (lastToken && lastToken.type === 'paragraph') {
          lastToken.text += '\n' + cap[0].trimRight();
        } else {
          cap = cap[0].replace(/^ {4}/gm, '');
          this.tokens.push({
            type: 'code',
            codeBlockStyle: 'indented',
            text: !this.options.pedantic
              ? rtrim(cap, '\n')
              : cap
          });
        }
        continue;
      }

      // fences
      if (cap = this.rules.fences.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'code',
          lang: cap[2] ? cap[2].trim() : cap[2],
          text: cap[3] || ''
        });
        continue;
      }

      // heading
      if (cap = this.rules.heading.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'heading',
          depth: cap[1].length,
          text: cap[2]
        });
        continue;
      }

      // table no leading pipe (gfm)
      if (cap = this.rules.nptable.exec(src)) {
        item = {
          type: 'table',
          header: splitCells(cap[1].replace(/^ *| *\| *$/g, '')),
          align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
          cells: cap[3] ? cap[3].replace(/\n$/, '').split('\n') : []
        };

        if (item.header.length === item.align.length) {
          src = src.substring(cap[0].length);

          for (i = 0; i < item.align.length; i++) {
            if (/^ *-+: *$/.test(item.align[i])) {
              item.align[i] = 'right';
            } else if (/^ *:-+: *$/.test(item.align[i])) {
              item.align[i] = 'center';
            } else if (/^ *:-+ *$/.test(item.align[i])) {
              item.align[i] = 'left';
            } else {
              item.align[i] = null;
            }
          }

          for (i = 0; i < item.cells.length; i++) {
            item.cells[i] = splitCells(item.cells[i], item.header.length);
          }

          this.tokens.push(item);

          continue;
        }
      }

      // hr
      if (cap = this.rules.hr.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'hr'
        });
        continue;
      }

      // blockquote
      if (cap = this.rules.blockquote.exec(src)) {
        src = src.substring(cap[0].length);

        this.tokens.push({
          type: 'blockquote_start'
        });

        cap = cap[0].replace(/^ *> ?/gm, '');

        // Pass `top` to keep the current
        // "toplevel" state. This is exactly
        // how markdown.pl works.
        this.token(cap, top);

        this.tokens.push({
          type: 'blockquote_end'
        });

        continue;
      }

      // list
      if (cap = this.rules.list.exec(src)) {
        src = src.substring(cap[0].length);
        bull = cap[2];
        isordered = bull.length > 1;

        listStart = {
          type: 'list_start',
          ordered: isordered,
          start: isordered ? +bull : '',
          loose: false
        };

        this.tokens.push(listStart);

        // Get each top-level item.
        cap = cap[0].match(this.rules.item);

        listItems = [];
        next = false;
        l = cap.length;
        i = 0;

        for (; i < l; i++) {
          item = cap[i];

          // Remove the list item's bullet
          // so it is seen as the next token.
          space = item.length;
          item = item.replace(/^ *([*+-]|\d+\.) */, '');

          // Outdent whatever the
          // list item contains. Hacky.
          if (~item.indexOf('\n ')) {
            space -= item.length;
            item = !this.options.pedantic
              ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
              : item.replace(/^ {1,4}/gm, '');
          }

          // Determine whether the next list item belongs here.
          // Backpedal if it does not belong in this list.
          if (i !== l - 1) {
            b = block.bullet.exec(cap[i + 1])[0];
            if (bull.length > 1 ? b.length === 1
              : (b.length > 1 || (this.options.smartLists && b !== bull))) {
              src = cap.slice(i + 1).join('\n') + src;
              i = l - 1;
            }
          }

          // Determine whether item is loose or not.
          // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
          // for discount behavior.
          loose = next || /\n\n(?!\s*$)/.test(item);
          if (i !== l - 1) {
            next = item.charAt(item.length - 1) === '\n';
            if (!loose) loose = next;
          }

          if (loose) {
            listStart.loose = true;
          }

          // Check for task list items
          istask = /^\[[ xX]\] /.test(item);
          ischecked = undefined;
          if (istask) {
            ischecked = item[1] !== ' ';
            item = item.replace(/^\[[ xX]\] +/, '');
          }

          t = {
            type: 'list_item_start',
            task: istask,
            checked: ischecked,
            loose: loose
          };

          listItems.push(t);
          this.tokens.push(t);

          // Recurse.
          this.token(item, false);

          this.tokens.push({
            type: 'list_item_end'
          });
        }

        if (listStart.loose) {
          l = listItems.length;
          i = 0;
          for (; i < l; i++) {
            listItems[i].loose = true;
          }
        }

        this.tokens.push({
          type: 'list_end'
        });

        continue;
      }

      // html
      if (cap = this.rules.html.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: this.options.sanitize
            ? 'paragraph'
            : 'html',
          pre: !this.options.sanitizer
            && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
          text: this.options.sanitize ? (this.options.sanitizer ? this.options.sanitizer(cap[0]) : escape(cap[0])) : cap[0]
        });
        continue;
      }

      // def
      if (top && (cap = this.rules.def.exec(src))) {
        src = src.substring(cap[0].length);
        if (cap[3]) cap[3] = cap[3].substring(1, cap[3].length - 1);
        tag = cap[1].toLowerCase().replace(/\s+/g, ' ');
        if (!this.tokens.links[tag]) {
          this.tokens.links[tag] = {
            href: cap[2],
            title: cap[3]
          };
        }
        continue;
      }

      // table (gfm)
      if (cap = this.rules.table.exec(src)) {
        item = {
          type: 'table',
          header: splitCells(cap[1].replace(/^ *| *\| *$/g, '')),
          align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
          cells: cap[3] ? cap[3].replace(/\n$/, '').split('\n') : []
        };

        if (item.header.length === item.align.length) {
          src = src.substring(cap[0].length);

          for (i = 0; i < item.align.length; i++) {
            if (/^ *-+: *$/.test(item.align[i])) {
              item.align[i] = 'right';
            } else if (/^ *:-+: *$/.test(item.align[i])) {
              item.align[i] = 'center';
            } else if (/^ *:-+ *$/.test(item.align[i])) {
              item.align[i] = 'left';
            } else {
              item.align[i] = null;
            }
          }

          for (i = 0; i < item.cells.length; i++) {
            item.cells[i] = splitCells(
              item.cells[i].replace(/^ *\| *| *\| *$/g, ''),
              item.header.length);
          }

          this.tokens.push(item);

          continue;
        }
      }

      // lheading
      if (cap = this.rules.lheading.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'heading',
          depth: cap[2].charAt(0) === '=' ? 1 : 2,
          text: cap[1]
        });
        continue;
      }

      // top-level paragraph
      if (top && (cap = this.rules.paragraph.exec(src))) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'paragraph',
          text: cap[1].charAt(cap[1].length - 1) === '\n'
            ? cap[1].slice(0, -1)
            : cap[1]
        });
        continue;
      }

      // text
      if (cap = this.rules.text.exec(src)) {
        // Top-level should never reach here.
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'text',
          text: cap[0]
        });
        continue;
      }

      if (src) {
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
      }
    }

    return this.tokens;
  };

  /**
   * Inline-Level Grammar
   */

  var inline = {
    escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
    autolink: /^<(scheme:[^\s\x00-\x1f<>]*|email)>/,
    url: noop,
    tag: '^comment'
      + '|^</[a-zA-Z][\\w:-]*\\s*>' // self-closing tag
      + '|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>' // open tag
      + '|^<\\?[\\s\\S]*?\\?>' // processing instruction, e.g. <?php ?>
      + '|^<![a-zA-Z]+\\s[\\s\\S]*?>' // declaration, e.g. <!DOCTYPE html>
      + '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>', // CDATA section
    link: /^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/,
    reflink: /^!?\[(label)\]\[(?!\s*\])((?:\\[\[\]]?|[^\[\]\\])+)\]/,
    nolink: /^!?\[(?!\s*\])((?:\[[^\[\]]*\]|\\[\[\]]|[^\[\]])*)\](?:\[\])?/,
    strong: /^__([^\s_])__(?!_)|^\*\*([^\s*])\*\*(?!\*)|^__([^\s][\s\S]*?[^\s])__(?!_)|^\*\*([^\s][\s\S]*?[^\s])\*\*(?!\*)/,
    em: /^_([^\s_])_(?!_)|^\*([^\s*<\[])\*(?!\*)|^_([^\s<][\s\S]*?[^\s_])_(?!_|[^\spunctuation])|^_([^\s_<][\s\S]*?[^\s])_(?!_|[^\spunctuation])|^\*([^\s<"][\s\S]*?[^\s\*])\*(?!\*|[^\spunctuation])|^\*([^\s*"<\[][\s\S]*?[^\s])\*(?!\*)/,
    code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
    br: /^( {2,}|\\)\n(?!\s*$)/,
    del: noop,
    text: /^(`+|[^`])(?:[\s\S]*?(?:(?=[\\<!\[`*]|\b_|$)|[^ ](?= {2,}\n))|(?= {2,}\n))/
  };

  // list of punctuation marks from common mark spec
  // without ` and ] to workaround Rule 17 (inline code blocks/links)
  inline._punctuation = '!"#$%&\'()*+,\\-./:;<=>?@\\[^_{|}~';
  inline.em = edit(inline.em).replace(/punctuation/g, inline._punctuation).getRegex();

  inline._escapes = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/g;

  inline._scheme = /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/;
  inline._email = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/;
  inline.autolink = edit(inline.autolink)
    .replace('scheme', inline._scheme)
    .replace('email', inline._email)
    .getRegex();

  inline._attribute = /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/;

  inline.tag = edit(inline.tag)
    .replace('comment', block._comment)
    .replace('attribute', inline._attribute)
    .getRegex();

  inline._label = /(?:\[[^\[\]]*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
  inline._href = /<(?:\\[<>]?|[^\s<>\\])*>|[^\s\x00-\x1f]*/;
  inline._title = /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/;

  inline.link = edit(inline.link)
    .replace('label', inline._label)
    .replace('href', inline._href)
    .replace('title', inline._title)
    .getRegex();

  inline.reflink = edit(inline.reflink)
    .replace('label', inline._label)
    .getRegex();

  /**
   * Normal Inline Grammar
   */

  inline.normal = merge({}, inline);

  /**
   * Pedantic Inline Grammar
   */

  inline.pedantic = merge({}, inline.normal, {
    strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
    em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/,
    link: edit(/^!?\[(label)\]\((.*?)\)/)
      .replace('label', inline._label)
      .getRegex(),
    reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/)
      .replace('label', inline._label)
      .getRegex()
  });

  /**
   * GFM Inline Grammar
   */

  inline.gfm = merge({}, inline.normal, {
    escape: edit(inline.escape).replace('])', '~|])').getRegex(),
    _extended_email: /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/,
    url: /^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,
    _backpedal: /(?:[^?!.,:;*_~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_~)]+(?!$))+/,
    del: /^~+(?=\S)([\s\S]*?\S)~+/,
    text: /^(`+|[^`])(?:[\s\S]*?(?:(?=[\\<!\[`*~]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))|(?= {2,}\n|[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))/
  });

  inline.gfm.url = edit(inline.gfm.url, 'i')
    .replace('email', inline.gfm._extended_email)
    .getRegex();
  /**
   * GFM + Line Breaks Inline Grammar
   */

  inline.breaks = merge({}, inline.gfm, {
    br: edit(inline.br).replace('{2,}', '*').getRegex(),
    text: edit(inline.gfm.text)
      .replace('\\b_', '\\b_| {2,}\\n')
      .replace(/\{2,\}/g, '*')
      .getRegex()
  });

  /**
   * Inline Lexer & Compiler
   */

  function InlineLexer(links, options) {
    this.options = options || marked.defaults;
    this.links = links;
    this.rules = inline.normal;
    this.renderer = this.options.renderer || new Renderer();
    this.renderer.options = this.options;

    if (!this.links) {
      throw new Error('Tokens array requires a `links` property.');
    }

    if (this.options.pedantic) {
      this.rules = inline.pedantic;
    } else if (this.options.gfm) {
      if (this.options.breaks) {
        this.rules = inline.breaks;
      } else {
        this.rules = inline.gfm;
      }
    }
  }

  /**
   * Expose Inline Rules
   */

  InlineLexer.rules = inline;

  /**
   * Static Lexing/Compiling Method
   */

  InlineLexer.output = function(src, links, options) {
    var inline = new InlineLexer(links, options);
    return inline.output(src);
  };

  /**
   * Lexing/Compiling
   */

  InlineLexer.prototype.output = function(src) {
    var out = '',
        link,
        text,
        href,
        title,
        cap,
        prevCapZero;

    while (src) {
      // escape
      if (cap = this.rules.escape.exec(src)) {
        src = src.substring(cap[0].length);
        out += escape(cap[1]);
        continue;
      }

      // tag
      if (cap = this.rules.tag.exec(src)) {
        if (!this.inLink && /^<a /i.test(cap[0])) {
          this.inLink = true;
        } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
          this.inLink = false;
        }
        if (!this.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
          this.inRawBlock = true;
        } else if (this.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
          this.inRawBlock = false;
        }

        src = src.substring(cap[0].length);
        out += this.options.sanitize
          ? this.options.sanitizer
            ? this.options.sanitizer(cap[0])
            : escape(cap[0])
          : cap[0];
        continue;
      }

      // link
      if (cap = this.rules.link.exec(src)) {
        var lastParenIndex = findClosingBracket(cap[2], '()');
        if (lastParenIndex > -1) {
          var linkLen = 4 + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = '';
        }
        src = src.substring(cap[0].length);
        this.inLink = true;
        href = cap[2];
        if (this.options.pedantic) {
          link = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href);

          if (link) {
            href = link[1];
            title = link[3];
          } else {
            title = '';
          }
        } else {
          title = cap[3] ? cap[3].slice(1, -1) : '';
        }
        href = href.trim().replace(/^<([\s\S]*)>$/, '$1');
        out += this.outputLink(cap, {
          href: InlineLexer.escapes(href),
          title: InlineLexer.escapes(title)
        });
        this.inLink = false;
        continue;
      }

      // reflink, nolink
      if ((cap = this.rules.reflink.exec(src))
          || (cap = this.rules.nolink.exec(src))) {
        src = src.substring(cap[0].length);
        link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
        link = this.links[link.toLowerCase()];
        if (!link || !link.href) {
          out += cap[0].charAt(0);
          src = cap[0].substring(1) + src;
          continue;
        }
        this.inLink = true;
        out += this.outputLink(cap, link);
        this.inLink = false;
        continue;
      }

      // strong
      if (cap = this.rules.strong.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.strong(this.output(cap[4] || cap[3] || cap[2] || cap[1]));
        continue;
      }

      // em
      if (cap = this.rules.em.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.em(this.output(cap[6] || cap[5] || cap[4] || cap[3] || cap[2] || cap[1]));
        continue;
      }

      // code
      if (cap = this.rules.code.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.codespan(escape(cap[2].trim(), true));
        continue;
      }

      // br
      if (cap = this.rules.br.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.br();
        continue;
      }

      // del (gfm)
      if (cap = this.rules.del.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.del(this.output(cap[1]));
        continue;
      }

      // autolink
      if (cap = this.rules.autolink.exec(src)) {
        src = src.substring(cap[0].length);
        if (cap[2] === '@') {
          text = escape(this.mangle(cap[1]));
          href = 'mailto:' + text;
        } else {
          text = escape(cap[1]);
          href = text;
        }
        out += this.renderer.link(href, null, text);
        continue;
      }

      // url (gfm)
      if (!this.inLink && (cap = this.rules.url.exec(src))) {
        if (cap[2] === '@') {
          text = escape(cap[0]);
          href = 'mailto:' + text;
        } else {
          // do extended autolink path validation
          do {
            prevCapZero = cap[0];
            cap[0] = this.rules._backpedal.exec(cap[0])[0];
          } while (prevCapZero !== cap[0]);
          text = escape(cap[0]);
          if (cap[1] === 'www.') {
            href = 'http://' + text;
          } else {
            href = text;
          }
        }
        src = src.substring(cap[0].length);
        out += this.renderer.link(href, null, text);
        continue;
      }

      // text
      if (cap = this.rules.text.exec(src)) {
        src = src.substring(cap[0].length);
        if (this.inRawBlock) {
          out += this.renderer.text(this.options.sanitize ? (this.options.sanitizer ? this.options.sanitizer(cap[0]) : escape(cap[0])) : cap[0]);
        } else {
          out += this.renderer.text(escape(this.smartypants(cap[0])));
        }
        continue;
      }

      if (src) {
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
      }
    }

    return out;
  };

  InlineLexer.escapes = function(text) {
    return text ? text.replace(InlineLexer.rules._escapes, '$1') : text;
  };

  /**
   * Compile Link
   */

  InlineLexer.prototype.outputLink = function(cap, link) {
    var href = link.href,
        title = link.title ? escape(link.title) : null;

    return cap[0].charAt(0) !== '!'
      ? this.renderer.link(href, title, this.output(cap[1]))
      : this.renderer.image(href, title, escape(cap[1]));
  };

  /**
   * Smartypants Transformations
   */

  InlineLexer.prototype.smartypants = function(text) {
    if (!this.options.smartypants) return text;
    return text
      // em-dashes
      .replace(/---/g, '\u2014')
      // en-dashes
      .replace(/--/g, '\u2013')
      // opening singles
      .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
      // closing singles & apostrophes
      .replace(/'/g, '\u2019')
      // opening doubles
      .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
      // closing doubles
      .replace(/"/g, '\u201d')
      // ellipses
      .replace(/\.{3}/g, '\u2026');
  };

  /**
   * Mangle Links
   */

  InlineLexer.prototype.mangle = function(text) {
    if (!this.options.mangle) return text;
    var out = '',
        l = text.length,
        i = 0,
        ch;

    for (; i < l; i++) {
      ch = text.charCodeAt(i);
      if (Math.random() > 0.5) {
        ch = 'x' + ch.toString(16);
      }
      out += '&#' + ch + ';';
    }

    return out;
  };

  /**
   * Renderer
   */

  function Renderer(options) {
    this.options = options || marked.defaults;
  }

  Renderer.prototype.code = function(code, infostring, escaped) {
    var lang = (infostring || '').match(/\S*/)[0];
    if (this.options.highlight) {
      var out = this.options.highlight(code, lang);
      if (out != null && out !== code) {
        escaped = true;
        code = out;
      }
    }

    if (!lang) {
      return '<pre><code>'
        + (escaped ? code : escape(code, true))
        + '</code></pre>';
    }

    return '<pre><code class="'
      + this.options.langPrefix
      + escape(lang, true)
      + '">'
      + (escaped ? code : escape(code, true))
      + '</code></pre>\n';
  };

  Renderer.prototype.blockquote = function(quote) {
    return '<blockquote>\n' + quote + '</blockquote>\n';
  };

  Renderer.prototype.html = function(html) {
    return html;
  };

  Renderer.prototype.heading = function(text, level, raw, slugger) {
    if (this.options.headerIds) {
      return '<h'
        + level
        + ' id="'
        + this.options.headerPrefix
        + slugger.slug(raw)
        + '">'
        + text
        + '</h'
        + level
        + '>\n';
    }
    // ignore IDs
    return '<h' + level + '>' + text + '</h' + level + '>\n';
  };

  Renderer.prototype.hr = function() {
    return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
  };

  Renderer.prototype.list = function(body, ordered, start) {
    var type = ordered ? 'ol' : 'ul',
        startatt = (ordered && start !== 1) ? (' start="' + start + '"') : '';
    return '<' + type + startatt + '>\n' + body + '</' + type + '>\n';
  };

  Renderer.prototype.listitem = function(text) {
    return '<li>' + text + '</li>\n';
  };

  Renderer.prototype.checkbox = function(checked) {
    return '<input '
      + (checked ? 'checked="" ' : '')
      + 'disabled="" type="checkbox"'
      + (this.options.xhtml ? ' /' : '')
      + '> ';
  };

  Renderer.prototype.paragraph = function(text) {
    return '<p>' + text + '</p>\n';
  };

  Renderer.prototype.table = function(header, body) {
    if (body) body = '<tbody>' + body + '</tbody>';

    return '<table>\n'
      + '<thead>\n'
      + header
      + '</thead>\n'
      + body
      + '</table>\n';
  };

  Renderer.prototype.tablerow = function(content) {
    return '<tr>\n' + content + '</tr>\n';
  };

  Renderer.prototype.tablecell = function(content, flags) {
    var type = flags.header ? 'th' : 'td';
    var tag = flags.align
      ? '<' + type + ' align="' + flags.align + '">'
      : '<' + type + '>';
    return tag + content + '</' + type + '>\n';
  };

  // span level renderer
  Renderer.prototype.strong = function(text) {
    return '<strong>' + text + '</strong>';
  };

  Renderer.prototype.em = function(text) {
    return '<em>' + text + '</em>';
  };

  Renderer.prototype.codespan = function(text) {
    return '<code>' + text + '</code>';
  };

  Renderer.prototype.br = function() {
    return this.options.xhtml ? '<br/>' : '<br>';
  };

  Renderer.prototype.del = function(text) {
    return '<del>' + text + '</del>';
  };

  Renderer.prototype.link = function(href, title, text) {
    href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
    if (href === null) {
      return text;
    }
    var out = '<a href="' + escape(href) + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += '>' + text + '</a>';
    return out;
  };

  Renderer.prototype.image = function(href, title, text) {
    href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
    if (href === null) {
      return text;
    }

    var out = '<img src="' + href + '" alt="' + text + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += this.options.xhtml ? '/>' : '>';
    return out;
  };

  Renderer.prototype.text = function(text) {
    return text;
  };

  /**
   * TextRenderer
   * returns only the textual part of the token
   */

  function TextRenderer() {}

  // no need for block level renderers

  TextRenderer.prototype.strong =
  TextRenderer.prototype.em =
  TextRenderer.prototype.codespan =
  TextRenderer.prototype.del =
  TextRenderer.prototype.text = function(text) {
    return text;
  };

  TextRenderer.prototype.link =
  TextRenderer.prototype.image = function(href, title, text) {
    return '' + text;
  };

  TextRenderer.prototype.br = function() {
    return '';
  };

  /**
   * Parsing & Compiling
   */

  function Parser(options) {
    this.tokens = [];
    this.token = null;
    this.options = options || marked.defaults;
    this.options.renderer = this.options.renderer || new Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.slugger = new Slugger();
  }

  /**
   * Static Parse Method
   */

  Parser.parse = function(src, options) {
    var parser = new Parser(options);
    return parser.parse(src);
  };

  /**
   * Parse Loop
   */

  Parser.prototype.parse = function(src) {
    this.inline = new InlineLexer(src.links, this.options);
    // use an InlineLexer with a TextRenderer to extract pure text
    this.inlineText = new InlineLexer(
      src.links,
      merge({}, this.options, { renderer: new TextRenderer() })
    );
    this.tokens = src.reverse();

    var out = '';
    while (this.next()) {
      out += this.tok();
    }

    return out;
  };

  /**
   * Next Token
   */

  Parser.prototype.next = function() {
    this.token = this.tokens.pop();
    return this.token;
  };

  /**
   * Preview Next Token
   */

  Parser.prototype.peek = function() {
    return this.tokens[this.tokens.length - 1] || 0;
  };

  /**
   * Parse Text Tokens
   */

  Parser.prototype.parseText = function() {
    var body = this.token.text;

    while (this.peek().type === 'text') {
      body += '\n' + this.next().text;
    }

    return this.inline.output(body);
  };

  /**
   * Parse Current Token
   */

  Parser.prototype.tok = function() {
    switch (this.token.type) {
      case 'space': {
        return '';
      }
      case 'hr': {
        return this.renderer.hr();
      }
      case 'heading': {
        return this.renderer.heading(
          this.inline.output(this.token.text),
          this.token.depth,
          unescape(this.inlineText.output(this.token.text)),
          this.slugger);
      }
      case 'code': {
        return this.renderer.code(this.token.text,
          this.token.lang,
          this.token.escaped);
      }
      case 'table': {
        var header = '',
            body = '',
            i,
            row,
            cell,
            j;

        // header
        cell = '';
        for (i = 0; i < this.token.header.length; i++) {
          cell += this.renderer.tablecell(
            this.inline.output(this.token.header[i]),
            { header: true, align: this.token.align[i] }
          );
        }
        header += this.renderer.tablerow(cell);

        for (i = 0; i < this.token.cells.length; i++) {
          row = this.token.cells[i];

          cell = '';
          for (j = 0; j < row.length; j++) {
            cell += this.renderer.tablecell(
              this.inline.output(row[j]),
              { header: false, align: this.token.align[j] }
            );
          }

          body += this.renderer.tablerow(cell);
        }
        return this.renderer.table(header, body);
      }
      case 'blockquote_start': {
        body = '';

        while (this.next().type !== 'blockquote_end') {
          body += this.tok();
        }

        return this.renderer.blockquote(body);
      }
      case 'list_start': {
        body = '';
        var ordered = this.token.ordered,
            start = this.token.start;

        while (this.next().type !== 'list_end') {
          body += this.tok();
        }

        return this.renderer.list(body, ordered, start);
      }
      case 'list_item_start': {
        body = '';
        var loose = this.token.loose;
        var checked = this.token.checked;
        var task = this.token.task;

        if (this.token.task) {
          body += this.renderer.checkbox(checked);
        }

        while (this.next().type !== 'list_item_end') {
          body += !loose && this.token.type === 'text'
            ? this.parseText()
            : this.tok();
        }
        return this.renderer.listitem(body, task, checked);
      }
      case 'html': {
        // TODO parse inline content if parameter markdown=1
        return this.renderer.html(this.token.text);
      }
      case 'paragraph': {
        return this.renderer.paragraph(this.inline.output(this.token.text));
      }
      case 'text': {
        return this.renderer.paragraph(this.parseText());
      }
      default: {
        var errMsg = 'Token with "' + this.token.type + '" type was not found.';
        if (this.options.silent) {
          console.log(errMsg);
        } else {
          throw new Error(errMsg);
        }
      }
    }
  };

  /**
   * Slugger generates header id
   */

  function Slugger() {
    this.seen = {};
  }

  /**
   * Convert string to unique id
   */

  Slugger.prototype.slug = function(value) {
    var slug = value
      .toLowerCase()
      .trim()
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
      .replace(/\s/g, '-');

    if (this.seen.hasOwnProperty(slug)) {
      var originalSlug = slug;
      do {
        this.seen[originalSlug]++;
        slug = originalSlug + '-' + this.seen[originalSlug];
      } while (this.seen.hasOwnProperty(slug));
    }
    this.seen[slug] = 0;

    return slug;
  };

  /**
   * Helpers
   */

  function escape(html, encode) {
    if (encode) {
      if (escape.escapeTest.test(html)) {
        return html.replace(escape.escapeReplace, function(ch) { return escape.replacements[ch]; });
      }
    } else {
      if (escape.escapeTestNoEncode.test(html)) {
        return html.replace(escape.escapeReplaceNoEncode, function(ch) { return escape.replacements[ch]; });
      }
    }

    return html;
  }

  escape.escapeTest = /[&<>"']/;
  escape.escapeReplace = /[&<>"']/g;
  escape.replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  escape.escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
  escape.escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;

  function unescape(html) {
    // explicitly match decimal, hex, and named HTML entities
    return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, function(_, n) {
      n = n.toLowerCase();
      if (n === 'colon') return ':';
      if (n.charAt(0) === '#') {
        return n.charAt(1) === 'x'
          ? String.fromCharCode(parseInt(n.substring(2), 16))
          : String.fromCharCode(+n.substring(1));
      }
      return '';
    });
  }

  function edit(regex, opt) {
    regex = regex.source || regex;
    opt = opt || '';
    return {
      replace: function(name, val) {
        val = val.source || val;
        val = val.replace(/(^|[^\[])\^/g, '$1');
        regex = regex.replace(name, val);
        return this;
      },
      getRegex: function() {
        return new RegExp(regex, opt);
      }
    };
  }

  function cleanUrl(sanitize, base, href) {
    if (sanitize) {
      try {
        var prot = decodeURIComponent(unescape(href))
          .replace(/[^\w:]/g, '')
          .toLowerCase();
      } catch (e) {
        return null;
      }
      if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
        return null;
      }
    }
    if (base && !originIndependentUrl.test(href)) {
      href = resolveUrl(base, href);
    }
    try {
      href = encodeURI(href).replace(/%25/g, '%');
    } catch (e) {
      return null;
    }
    return href;
  }

  function resolveUrl(base, href) {
    if (!baseUrls[' ' + base]) {
      // we can ignore everything in base after the last slash of its path component,
      // but we might need to add _that_
      // https://tools.ietf.org/html/rfc3986#section-3
      if (/^[^:]+:\/*[^/]*$/.test(base)) {
        baseUrls[' ' + base] = base + '/';
      } else {
        baseUrls[' ' + base] = rtrim(base, '/', true);
      }
    }
    base = baseUrls[' ' + base];

    if (href.slice(0, 2) === '//') {
      return base.replace(/:[\s\S]*/, ':') + href;
    } else if (href.charAt(0) === '/') {
      return base.replace(/(:\/*[^/]*)[\s\S]*/, '$1') + href;
    } else {
      return base + href;
    }
  }
  var baseUrls = {};
  var originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;

  function noop() {}
  noop.exec = noop;

  function merge(obj) {
    var i = 1,
        target,
        key;

    for (; i < arguments.length; i++) {
      target = arguments[i];
      for (key in target) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
          obj[key] = target[key];
        }
      }
    }

    return obj;
  }

  function splitCells(tableRow, count) {
    // ensure that every cell-delimiting pipe has a space
    // before it to distinguish it from an escaped pipe
    var row = tableRow.replace(/\|/g, function(match, offset, str) {
          var escaped = false,
              curr = offset;
          while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
          if (escaped) {
            // odd number of slashes means | is escaped
            // so we leave it alone
            return '|';
          } else {
            // add space before unescaped |
            return ' |';
          }
        }),
        cells = row.split(/ \|/),
        i = 0;

    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push('');
    }

    for (; i < cells.length; i++) {
      // leading or trailing whitespace is ignored per the gfm spec
      cells[i] = cells[i].trim().replace(/\\\|/g, '|');
    }
    return cells;
  }

  // Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
  // /c*$/ is vulnerable to REDOS.
  // invert: Remove suffix of non-c chars instead. Default falsey.
  function rtrim(str, c, invert) {
    if (str.length === 0) {
      return '';
    }

    // Length of suffix matching the invert condition.
    var suffLen = 0;

    // Step left until we fail to match the invert condition.
    while (suffLen < str.length) {
      var currChar = str.charAt(str.length - suffLen - 1);
      if (currChar === c && !invert) {
        suffLen++;
      } else if (currChar !== c && invert) {
        suffLen++;
      } else {
        break;
      }
    }

    return str.substr(0, str.length - suffLen);
  }

  function findClosingBracket(str, b) {
    if (str.indexOf(b[1]) === -1) {
      return -1;
    }
    var level = 0;
    for (var i = 0; i < str.length; i++) {
      if (str[i] === '\\') {
        i++;
      } else if (str[i] === b[0]) {
        level++;
      } else if (str[i] === b[1]) {
        level--;
        if (level < 0) {
          return i;
        }
      }
    }
    return -1;
  }

  function checkSanitizeDeprecation(opt) {
    if (opt && opt.sanitize && !opt.silent) {
      console.warn('marked(): sanitize and sanitizer parameters are deprecated since version 0.7.0, should not be used and will be removed in the future. Read more here: https://marked.js.org/#/USING_ADVANCED.md#options');
    }
  }

  /**
   * Marked
   */

  function marked(src, opt, callback) {
    // throw error in case of non string input
    if (typeof src === 'undefined' || src === null) {
      throw new Error('marked(): input parameter is undefined or null');
    }
    if (typeof src !== 'string') {
      throw new Error('marked(): input parameter is of type '
        + Object.prototype.toString.call(src) + ', string expected');
    }

    if (callback || typeof opt === 'function') {
      if (!callback) {
        callback = opt;
        opt = null;
      }

      opt = merge({}, marked.defaults, opt || {});
      checkSanitizeDeprecation(opt);

      var highlight = opt.highlight,
          tokens,
          pending,
          i = 0;

      try {
        tokens = Lexer.lex(src, opt);
      } catch (e) {
        return callback(e);
      }

      pending = tokens.length;

      var done = function(err) {
        if (err) {
          opt.highlight = highlight;
          return callback(err);
        }

        var out;

        try {
          out = Parser.parse(tokens, opt);
        } catch (e) {
          err = e;
        }

        opt.highlight = highlight;

        return err
          ? callback(err)
          : callback(null, out);
      };

      if (!highlight || highlight.length < 3) {
        return done();
      }

      delete opt.highlight;

      if (!pending) return done();

      for (; i < tokens.length; i++) {
        (function(token) {
          if (token.type !== 'code') {
            return --pending || done();
          }
          return highlight(token.text, token.lang, function(err, code) {
            if (err) return done(err);
            if (code == null || code === token.text) {
              return --pending || done();
            }
            token.text = code;
            token.escaped = true;
            --pending || done();
          });
        })(tokens[i]);
      }

      return;
    }
    try {
      if (opt) opt = merge({}, marked.defaults, opt);
      checkSanitizeDeprecation(opt);
      return Parser.parse(Lexer.lex(src, opt), opt);
    } catch (e) {
      e.message += '\nPlease report this to https://github.com/markedjs/marked.';
      if ((opt || marked.defaults).silent) {
        return '<p>An error occurred:</p><pre>'
          + escape(e.message + '', true)
          + '</pre>';
      }
      throw e;
    }
  }

  /**
   * Options
   */

  marked.options =
  marked.setOptions = function(opt) {
    merge(marked.defaults, opt);
    return marked;
  };

  marked.getDefaults = function() {
    return {
      baseUrl: null,
      breaks: false,
      gfm: true,
      headerIds: true,
      headerPrefix: '',
      highlight: null,
      langPrefix: 'language-',
      mangle: true,
      pedantic: false,
      renderer: new Renderer(),
      sanitize: false,
      sanitizer: null,
      silent: false,
      smartLists: false,
      smartypants: false,
      xhtml: false
    };
  };

  marked.defaults = marked.getDefaults();

  /**
   * Expose
   */

  marked.Parser = Parser;
  marked.parser = Parser.parse;

  marked.Renderer = Renderer;
  marked.TextRenderer = TextRenderer;

  marked.Lexer = Lexer;
  marked.lexer = Lexer.lex;

  marked.InlineLexer = InlineLexer;
  marked.inlineLexer = InlineLexer.output;

  marked.Slugger = Slugger;

  marked.parse = marked;

  {
    module.exports = marked;
  }
  })();
  });

  riot$1.tag2('article_view', '<virtual if="{article !== null}"> <article_body_field marked_body="{markedBody(article.body)}"></article_body_field> <ul class="tag-list"> <virtual each="{tagWord in article.tagList}"> <li class="tag-default tag-pill tag-outline">{tagWord}</li> </virtual> </ul> </virtual>', '', '', function(opts) {

  let self = this;
  self.article = null;

  self.setArticle = ( article ) => {
      self.article = article;
      self.update();
  };

  self.markedBody = ( body ) => {
      return marked( self.article.body )
  };

  });

  riot$1.tag2('article_body_field', '', '', '', function(opts) {
  this.root.innerHTML = opts.marked_body;
  this.on("update", () => {
      this.root.innerHTML = opts.marked_body;
  });
  });

  riot$1.tag2('comment_form_view', '<form class="card comment-form"> <div class="card-block"> <textarea ref="commentArea" class="form-control" placeholder="Write a comment..." rows="3"></textarea> </div> <div class="card-footer"> <virtual if="{profile !== null}"> <img riot-src="{profile.image}" class="comment-author-img"> </virtual> <button onclick="{actionOfPostCommentButton}" type="button" class="btn btn-sm btn-primary"> Post Comment </button> </div> </form>', '', '', function(opts) {

  var self = this;
  self.profile = null;

  self.didSubmitHandler = () => {};
  self.setProfile = ( profile ) => {
      self.profile = profile;
      self.update();
  };

  self.actionOfPostCommentButton = () => {
      let comment = self.refs.commentArea.value;
      self.didSubmitHandler( comment );
  };

  self.clearComment = () => {
      self.refs.commentArea.value = "";
  };

  });

  riot$1.tag2('comment_table_view', '<div class="card" each="{comment in comments}"> <div class="card-block"> <p class="card-text"> <comment_body_view marked_body="{markedBody( comment.body )}"></comment_body_view> </p> </div> <div class="card-footer"> <a href="" class="comment-author"> <img riot-src="{comment.author.image}" class="comment-author-img"> </a> &nbsp; <a href="" class="comment-author">{comment.author.username}</a> <span class="date-posted">{formattedDate( comment.createdAt )}</span> <virtual if="{comment.author.username === loggedUserProfile.username}"> <span class="mod-options"> <i onclick="{actionOfTrashButton.bind( this, comment.id )}" class="ion-trash-a"></i> </span> </virtual> </div> </div>', '', '', function(opts) {

  var self = this;
  self.comments = [];
  self.loggedUserProfile = null;

  self.didDeleteHandler = () => {};
  self.setComments = ( comments ) => {
      self.comments = comments;
      self.update();
  };

  self.markedBody = ( body ) => {
      return marked( body )
  };

  self.formattedDate = ( date ) => {
      return moment( date ).format("MMMM DD, YYYY");
  };

  self.actionOfTrashButton = ( commentId ) => {
      self.didDeleteHandler( commentId );
  };

  });

  riot$1.tag2('comment_body_view', '', '', '', function(opts) {
  this.root.innerHTML = opts.marked_body;
  this.on("update", () => {
      this.root.innerHTML = opts.marked_body;
  });
  });

  class ArticleUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this._article = null;
          this._comments = [];
          this.isLoggedIn = () => {
              return this.storage.isLoggedIn();
          };
          this.loggedUser = () => {
              return this.storage.user();
          };
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.loggedUserProfile = () => {
              return this.storage.user().profile();
          };
          this.requestArticle = () => {
              let slug = SPALocation.shared().paths()[0];
              let token = this.storage.user() == null ? null : this.storage.user().token;
              if (slug !== null) {
                  return this.conduit.getArticle(slug, token).then((article) => {
                      this._article = article;
                      return article;
                  });
              }
          };
          this.currentArticle = () => {
              return this._article;
          };
          this.currentComments = () => {
              return this._comments;
          };
          this.requestComments = () => {
              let slug = SPALocation.shared().paths()[0];
              return this.conduit.getComments(slug).then((comments) => {
                  this._comments = comments;
                  return comments;
              });
          };
          this.toggleFollowing = () => {
              let article = this._article;
              if (article === null) {
                  throw Error("An article is empty.");
              }
              // follow/unfollow
              let token = this.storage.user().token;
              let username = article.author.username;
              let process = (p) => { this._article.author = p; return p; };
              switch (article.author.following) {
                  case true: return this.conduit.unfollow(token, username).then(process);
                  case false: return this.conduit.follow(token, username).then(process);
              }
          };
          this.toggleFavorite = () => {
              let article = this._article;
              if (article === null) {
                  throw Error("Article is empty.");
              }
              let token = this.storage.user().token;
              let slug = SPALocation.shared().paths()[0];
              let process = (a) => { this._article = a; return a; };
              let favorited = article.favorited;
              switch (favorited) {
                  case true: return this.conduit.unfavorite(token, slug).then(process);
                  case false: return this.conduit.favorite(token, slug).then(process);
              }
          };
          this.postComment = (comment) => {
              let token = this.storage.user().token;
              let slug = SPALocation.shared().paths()[0];
              return this.conduit.postComment(token, slug, comment).then((comment) => {
                  this._comments.unshift(comment);
                  return comment;
              });
          };
          this.deleteComment = (commentId) => {
              let token = this.storage.user().token;
              let slug = SPALocation.shared().paths()[0];
              return this.conduit.deleteComment(token, slug, commentId).then(() => {
                  let index = this._comments.findIndex((target) => target.id === commentId);
                  this._comments.splice(index, 1);
              });
          };
          this.deleteArticle = () => {
              let token = this.storage.user().token;
              let slug = SPALocation.shared().paths()[0];
              return this.conduit.deleteArticle(token, slug);
          };
          this.jumpToEditerScene = () => {
              location.href = new SPAPathBuilder("editer", [this._article.slug]).fullPath();
          };
          this.jumpToHome = () => {
              location.href = "/";
          };
          this.state = new ArticleState(SPALocation.shared());
      }
  }
  class ArticleState {
      constructor(location) {
          // scene
          this.scene = location.scene();
      }
  }

  riot$1.tag2('article_view_controller', '<header_view></header_view> <div class="article-page"> <div class="banner"> <div class="container"> <h1>{currentArticleTitle()}</h1> <article_widget_view ref="above_widget_view"></article_widget_view> </div> </div> <div class="container page"> <div class="row article-content"> <div class="col-md-12"> <article_view></article_view> </div> </div> </div> <hr> <div class="article-actions"> <article_widget_view ref="below_widget_view"></article_widget_view> </div> <div class="row"> <div class="col-xs-12 col-md-8 offset-md-2"> <comment_form_view></comment_form_view> <comment_table_view></comment_table_view> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new ArticleUseCase();

  this.on("mount", () => {

      self.tags.header_view.setItems( useCase.menuItems() );

      if (useCase.isLoggedIn()){
          let profile = useCase.loggedUserProfile();
          self.refs.above_widget_view.loggedUserProfile = profile;
          self.refs.below_widget_view.loggedUserProfile = profile;
          self.tags.comment_table_view.loggedUserProfile = profile;
          self.tags.comment_form_view.setProfile( profile );
      }

      useCase.requestArticle().then( (article) => {
          self.tags.article_view.setArticle( article );
          setArticleForWidgets( article );
          self.update();
      });

      useCase.requestComments().then( (comments) => {
          self.tags.comment_table_view.setComments( comments );
      });

      if ( useCase.isLoggedIn() == false ){ return }

      let didFollowHandler = () => {
          useCase.toggleFollowing().then( () =>{
              setArticleForWidgets( useCase.currentArticle() );
          });
      };
      let didFavoriteHandler = () => {
          useCase.toggleFavorite().then( () =>{
              setArticleForWidgets( useCase.currentArticle() );
          });
      };
      let didEditingHandler = () => {
          useCase.jumpToEditerScene();
      };
      let didDeleteHandler = () => {
          useCase.deleteArticle().then( () => {
              useCase.jumpToHome();
          });
      };
      self.refs.above_widget_view.didFollowHandler = didFollowHandler;
      self.refs.below_widget_view.didFollowHandler = didFollowHandler;
      self.refs.above_widget_view.didFavoriteHandler = didFavoriteHandler;
      self.refs.below_widget_view.didFavoriteHandler = didFavoriteHandler;
      self.refs.above_widget_view.didEditingHandler = didEditingHandler;
      self.refs.below_widget_view.didEditingHandler = didEditingHandler;
      self.refs.above_widget_view.didDeleteHandler = didDeleteHandler;
      self.refs.below_widget_view.didDeleteHandler = didDeleteHandler;

      self.tags.comment_form_view.didSubmitHandler = ( comment ) => {
          useCase.postComment( comment ).then( () => {
              self.tags.comment_table_view.setComments( useCase.currentComments() );
              self.tags.comment_form_view.clearComment();
          });
      };
      self.tags.comment_table_view.didDeleteHandler = ( commentId ) => {
          useCase.deleteComment( commentId ).then( () => {
              self.tags.comment_table_view.setComments( useCase.currentComments() );
          });
      };
  });

  self.currentArticleTitle = () => {
      let article = useCase.currentArticle();
      return article !== null ? article.title : ""
  };

  var setArticleForWidgets = (article) => {
      self.refs.above_widget_view.setArticle( article );
      self.refs.below_widget_view.setArticle( article );
  };

  });

  class PostArticle {
      constructor(title, description, body, tagList) {
          this.title = title;
          this.description = description;
          this.body = body;
          this.tagList = tagList;
      }
  }

  class EditerUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this.isLoggedIn = () => {
              return this.storage.isLoggedIn();
          };
          this.loggedUser = () => {
              return this.storage.user();
          };
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.ifNeededRequestArticle = () => {
              if (this.state.slug === null) {
                  // needless
                  return new Promise((resolve, _) => __awaiter(this, void 0, void 0, function* () { resolve(null); }));
              }
              return this.conduit.getArticle(this.state.slug);
          };
          this.isNewArticle = () => {
              return this.state.slug === null;
          };
          this.post = (title, description, body, tagList) => {
              let splitted = tagList.split(",");
              let tags = (splitted.length > 0 ? splitted : null);
              if (this.state.slug === null) {
                  // new article
                  return this.conduit.postArticle(this.storage.user().token, new PostArticle(title, description, body, tags));
              }
              else {
                  // update
                  return this.conduit.updateArticle(this.storage.user().token, new PostArticle(title, description, body, tags), this.state.slug);
              }
          };
          this.jumpToArticleScene = (article) => {
              location.href = new SPAPathBuilder("article", [article.slug]).fullPath();
          };
          this.jumpToNotFound = () => {
              location.href = "#/notfound";
          };
          this.state = new EditerState(SPALocation.shared());
      }
  }
  class EditerState {
      constructor(location) {
          // scene
          this.scene = location.scene();
          // slug
          let paths = location.paths() ? location.paths() : [];
          this.slug = (paths.length >= 1) ? paths[0] : null;
      }
  }

  riot$1.tag2('editer_view_controller', '<header_view></header_view> <div class="editor-page"> <div class="container page"> <div class="row"> <div class="col-md-10 offset-md-1 col-xs-12"> <ul if="{errors != null}" class="error-messages"> <li each="{error in errors}">{error}</li> </ul> <form> <fieldset> <fieldset class="form-group"> <input ref="titleField" type="text" class="form-control form-control-lg" placeholder="Article Title"> </fieldset> <fieldset class="form-group"> <input ref="descriptionField" type="text" class="form-control" placeholder="What\'s this article about?"> </fieldset> <fieldset class="form-group"> <textarea ref="bodyField" class="form-control" rows="8" placeholder="Write your article (in markdown)"></textarea> </fieldset> <fieldset class="form-group"> <input ref="tagListField" type="text" class="form-control" placeholder="Enter tags"><div class="tag-list"></div> </fieldset> <button class="btn btn-lg pull-xs-right btn-primary" type="button" onclick="{actionOfSubmitButton}"> {submitButtonTitle()} </button> </fieldset> </form> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new EditerUseCase();

  self.errors = null;

  self.on("mount", () => {

      if( useCase.isLoggedIn() === false ){
          useCase.jumpToNotFound();
          return
      }

      self.tags.header_view.setItems( useCase.menuItems() );

      useCase.ifNeededRequestArticle().then( (article) => {
          if (article === null ) return

          self.refs.titleField.value = article.title;
          self.refs.descriptionField.value = article.description;
          self.refs.bodyField.value = article.body;
          self.refs.tagListField.value = article.tagList.join(",");
      });
  });

  self.actionOfSubmitButton = () => {
      let title = self.refs.titleField.value;
      let description = self.refs.descriptionField.value;
      let body = self.refs.bodyField.value;
      let tagList = self.refs.tagListField.value;

      useCase.post(title, description, body, tagList).then( (article) => {

          useCase.jumpToArticleScene(article);
      }).catch( (error) => {

          if (error instanceof Array ) {
              self.errors = error.map( (aError) => aError.message );
          }else if( error instanceof Error ) {
              self.errors = [ error.message ];
          }
          self.update();
      });
  };

  self.submitButtonTitle = () => {
      return useCase.isNewArticle() ? "Publish Article" : "Update Article"
  };

  });

  class PostUser {
      constructor(email, username, bio, image, password) {
          this.trimmed = () => {
              let object = {
                  "email": this.email,
                  "username": this.username,
                  "bio": this.bio,
                  "image": this.image
              };
              if (this.password || this.password.length !== 0) {
                  object["password"] = this.password;
              }
              return object;
          };
          this.email = email;
          this.username = username;
          this.bio = bio;
          this.image = image;
          this.password = password;
      }
  }
  PostUser.init = (object) => {
      return new PostUser(object.email, object.username, object.bio, object.image, object.password);
  };

  class SettingsUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this.isLoggedIn = () => {
              return this.storage.isLoggedIn();
          };
          this.loggedUser = () => {
              return this.storage.user();
          };
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.post = (email, username, bio, image, password) => {
              return this.conduit.updateUser(this.storage.user().token, new PostUser(email, username, bio, image, password));
          };
          this.logoutAfterJumpToHome = () => {
              this.storage.setUser(null);
              this.jumpToHome();
          };
          this.jumpToHome = () => {
              location.href = "/";
          };
          this.jumpToNotFound = () => {
              location.href = "#/notfound";
          };
          this.state = new SettingsState(SPALocation.shared());
      }
  }
  class SettingsState {
      constructor(location) {
          // scene
          this.scene = location.scene();
      }
  }

  riot$1.tag2('settings_view_controller', '<header_view></header_view> <div class="settings-page"> <div class="container page"> <div class="row"> <div class="col-md-6 offset-md-3 col-xs-12"> <h1 class="text-xs-center">Your Settings</h1> <ul if="{errors != null}" class="error-messages"> <li each="{error in errors}">{error}</li> </ul> <form> <fieldset> <fieldset class="form-group"> <input ref="iconURLField" class="form-control" type="text" placeholder="URL of profile picture"> </fieldset> <fieldset class="form-group"> <input ref="nameField" class="form-control form-control-lg" type="text" placeholder="Your Name"> </fieldset> <fieldset class="form-group"> <textarea ref="bioField" class="form-control form-control-lg" rows="8" placeholder="Short bio about you"></textarea> </fieldset> <fieldset class="form-group"> <input ref="emailField" class="form-control form-control-lg" type="text" placeholder="Email"> </fieldset> <fieldset class="form-group"> <input ref="passwordField" class="form-control form-control-lg" type="password" placeholder="Password"> </fieldset> <button class="btn btn-lg btn-primary pull-xs-right" type="button" onclick="{actionOfUpdateButton}"> Update Settings </button> </fieldset> </form> <hr> <button class="btn btn-outline-danger" onclick="{actionOfLogoutButton}"> Or click here to logout. </button> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new SettingsUseCase();

  self.errors = null;

  this.on("mount", () => {

      if( useCase.isLoggedIn() === false ){
          useCase.jumpToNotFound();
          return
      }

      self.tags.header_view.setItems( useCase.menuItems() );

      let user = useCase.loggedUser();
      self.refs.iconURLField.value = user.image;
      self.refs.nameField.value = user.username;
      self.refs.bioField.value = user.bio;
      self.refs.emailField.value = user.email;
  });

  self.actionOfUpdateButton = () => {
      let email = this.refs.emailField.value;
      let username = this.refs.nameField.value;
      let bio = this.refs.bioField.value;
      let image = this.refs.iconURLField.value;
      let password = this.refs.passwordField.value;

      useCase.post(email, username, bio, image, password).then( (user) => {

          useCase.jumpToHome();
      }).catch( (error) => {

          if (error instanceof Array ) {
              self.errors = error.map( (aError) => aError.message );
          }else if( error instanceof Error ) {
              self.errors = [ error.message ];
          }
          self.update();
      });
  };

  self.actionOfLogoutButton = () => {
      useCase.logoutAfterJumpToHome();
  };

  });

  riot$1.tag2('profile_view', '<virtual if="{profile !== null}"> <img riot-src="{profile.image}" class="user-img"> <h4>{profile.username}</h4> <p>{profile.bio}</p> <button onclick="{actionOfProfileButton}" class="{⁗btn btn-sm action-btn⁗ + ( profile.following ? ⁗ btn-secondary⁗ : ⁗ btn-outline-secondary⁗ )}"> <i class="{isOwn === true ? ⁗ion-gear-a⁗ : ⁗ion-plus-round⁗}"></i>&nbsp;{buttonTitle()} </button> </virtual>', '', '', function(opts) {

  var self = this;

  self.profile = null;
  self.isLoggedIn = false;
  self.isOwn = false;
  self.didClickButtonHandler = () => {};

  self.setProfile = ( profile, isLoggedIn, isOwn ) => {
      self.profile = profile;
      self.isLoggedIn = isLoggedIn;
      self.isOwn = isOwn;
      self.update();
  };

  self.buttonTitle = () => {
      let prof = self.profile;
      if ( self.isOwn == true ){
          return "Edit Profile Settings"
      }else{
          return ( prof.following ? "Unfollow" : "Follow" ) + " " + prof.username
      }
  };

  self.actionOfProfileButton = () => {
      self.didClickButtonHandler( self.isOwn );
  };

  });

  class ProfileUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this.container = null;
          this.isLoggedIn = () => {
              return this.storage.isLoggedIn();
          };
          this.loggedUser = () => {
              return this.storage.user();
          };
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.isOwnedProfile = () => {
              let user = this.storage.user();
              if (user == null) {
                  return false;
              }
              return user.username === this.profile.username;
          };
          this.requestProfile = () => {
              let token = this.storage.user() != null ? this.storage.user().token : null;
              return this.conduit.getProfile(this.state.username, token).then((p) => { this.profile = p; return p; });
          };
          this.requestArticles = () => {
              // calc offset
              let limit = Settings.shared().valueForKey("countOfArticleInView");
              let page = this.currentPage();
              let offset = page == null ? null : (page - 1) * limit;
              // prepare request
              let token = this.storage.user() != null ? this.storage.user().token : null;
              let nextProcess = (c) => { this.container = c; return c; };
              // request
              switch (this.state.articleKind) {
                  case "favorite_articles":
                      return this.conduit.getArticlesForFavoriteUser(this.state.username, token, limit, offset).then(nextProcess);
                      break;
                  default:
                      return this.conduit.getArticlesOfAuthor(this.state.username, token, limit, offset).then(nextProcess);
                      break;
              }
          };
          this.pageCount = () => {
              if (this.container == null || this.container.count === 0) {
                  return 0;
              }
              let limit = Settings.shared().valueForKey("countOfArticleInView");
              return Math.floor(this.container.count / limit);
          };
          this.currentPage = () => {
              return this.state.page;
          };
          this.tabItems = () => {
              let tabs = [
                  new ArticleTabItem("my_articles", "My Articles", (this.state.articleKind === "my_articles")),
                  new ArticleTabItem("favorite_articles", "Favorite Articles", (this.state.articleKind === "favorite_articles"))
              ];
              return tabs;
          };
          this.toggleFollowing = () => {
              let profile = this.profile;
              if (profile === null) {
                  throw Error("A profile is empty.");
              }
              // follow/unfollow
              let token = this.storage.user().token;
              let username = profile.username;
              let process = (p) => { this.profile = p; return p; };
              switch (profile.following) {
                  case true: return this.conduit.unfollow(token, username).then(process);
                  case false: return this.conduit.follow(token, username).then(process);
              }
          };
          this.jumpPage = (page) => {
              let pathBuilder = new SPAPathBuilder(this.state.scene, [this.state.username, this.state.articleKind], { "page": String(page) });
              location.href = pathBuilder.fullPath();
          };
          this.jumpToSubPath = (path) => {
              let pathBuilder = new SPAPathBuilder(this.state.scene, [this.state.username, path]);
              location.href = pathBuilder.fullPath();
          };
          this.jumpToSettingScene = () => {
              location.href = new SPAPathBuilder("settings").fullPath();
          };
          this.jumpToProfileScene = (profile) => {
              location.href = new SPAPathBuilder("profile", [profile.username]).fullPath();
          };
          this.jumpToArticleScene = (article) => {
              location.href = new SPAPathBuilder("article", [article.slug]).fullPath();
          };
          this.toggleFavorite = (article) => {
              if (article === null) {
                  throw Error("Article is empty.");
              }
              let user = this.storage.user();
              if (user === null) {
                  return new Promise((resolve, _) => __awaiter(this, void 0, void 0, function* () { resolve(null); }));
              }
              let process = (article) => {
                  let filtered = this.container.articles.filter(a => a.slug === article.slug)[0];
                  let index = this.container.articles.indexOf(filtered);
                  this.container.articles.splice(index, 1, article);
                  return this.container.articles;
              };
              switch (article.favorited) {
                  case true: return this.conduit.unfavorite(user.token, article.slug).then(process);
                  case false: return this.conduit.favorite(user.token, article.slug).then(process);
              }
          };
          this.state = new ProfileState(SPALocation.shared());
      }
  }
  class ProfileState {
      constructor(location) {
          // scene
          this.scene = location.scene();
          // username
          let paths = location.paths();
          if (paths.length >= 1) {
              this.username = paths[0];
          }
          else {
              throw Error("A username is can't empty in this scene.");
          }
          // articleKind
          this.articleKind = (paths.length === 2) ? paths[1] : "my_articles";
          if (paths.length >= 3) {
              throw Error("Unexpected query of http.");
          }
          // page
          switch (location.query()) {
              case undefined:
              case null:
                  this.page = 1;
                  break;
              default:
                  let page = location.query()["page"];
                  if (page === undefined || page == null) {
                      this.page = 1;
                  }
                  else {
                      this.page = Number(page);
                  }
          }
      }
  }

  riot$1.tag2('profile_view_controller', '<header_view></header_view> <div class="profile-page"> <div class="user-info"> <div class="container"> <div class="row"> <div class="col-xs-12 col-md-10 offset-md-1"> <profile_view></profile_view> </div> </div> </div> </div> <div class="container"> <div class="row"> <div class="col-xs-12 col-md-10 offset-md-1"> <article_tab_view toggle_style="articles-toggle"></article_tab_view> <articles_table_view></articles_table_view> <pagenation_view></pagenation_view> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new ProfileUseCase();

  this.on("mount", () => {

      self.tags.header_view.setItems( useCase.menuItems() );

      useCase.requestProfile().then( (profile) => {

          self.tags.profile_view.setProfile( profile, useCase.isLoggedIn(), useCase.isOwnedProfile() );
      });

      useCase.requestArticles().then( (container) => {

          self.tags.articles_table_view.setArticles( container.articles );

          self.tags.pagenation_view.shownPage = useCase.currentPage();
          self.tags.pagenation_view.setCountOfPage( useCase.pageCount() );
      });

      self.tags.article_tab_view.setItems( useCase.tabItems() );

      self.tags.article_tab_view.didSelectTab = (item) => {
          useCase.jumpToSubPath(item.identifier);
      };
      self.tags.articles_table_view.didSelectArticle = (article) => {
          useCase.jumpToArticleScene(article);
      };
      self.tags.articles_table_view.didSelectProfile  = (profile) => {
          useCase.jumpToProfileScene(profile);
      };
      self.tags.pagenation_view.didSelectPageNumber = (page) => {
          useCase.jumpPage(page);
      };

      if ( useCase.isLoggedIn() == false ){ return }

      self.tags.articles_table_view.didFavorite = (article) => {
          useCase.toggleFavorite(article).then( articles => {
              if ( articles === null ) return
              self.tags.articles_table_view.setArticles( articles );
          });
      };
      self.tags.profile_view.didClickButtonHandler = (isOwned) => {
          if (isOwned){
              useCase.jumpToSettingScene();
          }else{
              useCase.toggleFollowing().then( (profile) =>{
                  self.tags.profile_view.setProfile( profile, useCase.isLoggedIn(), useCase.isOwnedProfile() );
              });
          }
      };
  });

  });

  class RegisterUseCase {
      constructor() {
          this.conduit = new ConduitProductionRepository();
          this.storage = new UserLocalStorageRepository();
          this.register = (username, email, password) => __awaiter(this, void 0, void 0, function* () {
              return this.conduit.register(username, email, password).then((user) => {
                  this.storage.setUser(user);
              });
          });
          this.menuItems = () => {
              return new MenuItemsBuilder().items(this.state.scene, this.storage.user());
          };
          this.state = new RegisterState(SPALocation.shared());
      }
  }
  class RegisterState {
      constructor(location) {
          // scene
          this.scene = location.scene();
      }
  }

  riot$1.tag2('register_view_controller', '<header_view></header_view> <div class="auth-page"> <div class="container page"> <div class="row"> <div class="col-md-6 offset-md-3 col-xs-12"> <h1 class="text-xs-center">Sign Up</h1> <p class="text-xs-center"> <a href="#/login">Have an account?</a> </p> <ul if="{errors != null}" class="error-messages"> <li each="{error in errors}">{error}</li> </ul> <fieldset class="form-group"> <input ref="usernameField" class="form-control form-control-lg" type="text" placeholder="Username" oninput="{shouldSubmit}"> </fieldset> <fieldset class="form-group"> <input ref="emailField" class="form-control form-control-lg" type="text" placeholder="Email" oninput="{shouldSubmit}"> </fieldset> <fieldset class="form-group"> <input ref="passwordField" class="form-control form-control-lg" type="password" placeholder="Password" oninput="{shouldSubmit}"> </fieldset> <button ref="submitButton" class="btn btn-lg btn-primary pull-xs-right" onclick="{actionOfSubmitButton}" disabled> Sign up </button> </div> </div> </div> </div> <footer_view></footer_view>', '', '', function(opts) {

  var self = this;
  var useCase = new RegisterUseCase();
  self.errors = null;

  this.on("mount", () => {

      self.tags.header_view.setItems( useCase.menuItems() );
  });

  self.actionOfSubmitButton = ( event ) => {
      useCase.register( self.refs.usernameField.value, self.refs.emailField.value, self.refs.passwordField.value ).then( () => {

          window.location.href = "/";
      }).catch( (error) => {

          if (error instanceof Array ) {
              self.errors = error.map( (aError) => aError.message );
          }else if( error instanceof Error ) {
              self.errors = [ error.message ];
          }
          self.update();
      });
  };

  self.shouldSubmit = ( event ) => {
      self.refs.submitButton.disabled = (
          self.refs.usernameField.value.length == 0 ||
          self.refs.emailField.value.length == 0 ||
          self.refs.passwordField.value.length == 0
      );
  };

  });

  riot$1.tag2('notfound_view_controller', '<div class="home-page"> <header_view></header_view> <div class="banner"> <div class="container"> <h1 class="logo-font">Your order is not found.<br>Sorry, Please back <a class="spotlink" href="/">home</a>.</h1> </div> </div> <footer_view></footer_view> </div>', 'notfound_view_controller .spotlink,[data-is="notfound_view_controller"] .spotlink{ color: white; text-decoration: underline; } notfound_view_controller .spotlink:hover,[data-is="notfound_view_controller"] .spotlink:hover{ color: white; }', '', function(opts) {
  });

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

  class ApplicationUseCase {
      constructor() {
          this.scenes = [{
                  identifier: "login",
                  filter: "/login",
                  viewControllerName: "login_view_controller"
              }, {
                  identifier: "settings",
                  filter: "/settings",
                  viewControllerName: "settings_view_controller"
              }, {
                  identifier: "articles",
                  filter: "/articles..",
                  viewControllerName: "articles_view_controller"
              }, {
                  identifier: "article",
                  filter: "/article..",
                  viewControllerName: "article_view_controller"
              }, {
                  identifier: "editer",
                  filter: "/editer..",
                  viewControllerName: "editer_view_controller"
              }, {
                  identifier: "profile",
                  filter: "/profile..",
                  viewControllerName: "profile_view_controller"
              }, {
                  identifier: "register",
                  filter: "/register",
                  viewControllerName: "register_view_controller"
              }, {
                  identifier: "",
                  filter: "/",
                  viewControllerName: "articles_view_controller"
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
              // Parallel request
              Promise.all([requestSettings])
                  .then(() => {
                  // set title
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
              // Not Found
              route(() => {
                  riot$1.mount("div#mainView", "notfound_view_controller");
              });
              // Expected routing
              this.scenes.forEach(scene => {
                  route(scene.filter, () => {
                      riot$1.mount("div#mainView", scene.viewControllerName);
                  });
              });
          };
          this.routing = () => {
              let loc = SPALocation.shared();
              // Decide what to mount
              let vcname;
              if (loc.scene()) {
                  let filterd = this.scenes.filter(scene => scene.identifier === loc.scene());
                  vcname = (filterd.length > 0) ? filterd[0].viewControllerName : "notfound_view_controller";
              }
              else {
                  vcname = "articles_view_controller";
              }
              setTimeout(() => {
                  riot$1.mount("div#mainView", vcname);
              }, 5);
          };
      }
  }

  riot$1.tag2('application', '<div id="mainView"></div>', '', '', function(opts) {
  var useCase = new ApplicationUseCase();

  this.on("mount", function() {
      useCase.initialize( function( error ){
          if (error != null){

              throw Error("Initialize is failed");
          }
          useCase.setRoute();
          useCase.routing();
      });
  });
  });

  // Import Polyfill
  // Launch Application
  riot$1.mount("application");

}());
