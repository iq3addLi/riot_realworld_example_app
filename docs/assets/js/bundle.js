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

  /* Riot v4.3.7, @license MIT */
  const COMPONENTS_IMPLEMENTATION_MAP = new Map(),
        DOM_COMPONENT_INSTANCE_PROPERTY = Symbol('riot-component'),
        PLUGINS_SET = new Set(),
        IS_DIRECTIVE = 'is',
        VALUE_ATTRIBUTE = 'value',
        ATTRIBUTES_KEY_SYMBOL = Symbol('attributes'),
        TEMPLATE_KEY_SYMBOL = Symbol('template');

  var globals = /*#__PURE__*/Object.freeze({
    COMPONENTS_IMPLEMENTATION_MAP: COMPONENTS_IMPLEMENTATION_MAP,
    DOM_COMPONENT_INSTANCE_PROPERTY: DOM_COMPONENT_INSTANCE_PROPERTY,
    PLUGINS_SET: PLUGINS_SET,
    IS_DIRECTIVE: IS_DIRECTIVE,
    VALUE_ATTRIBUTE: VALUE_ATTRIBUTE,
    ATTRIBUTES_KEY_SYMBOL: ATTRIBUTES_KEY_SYMBOL,
    TEMPLATE_KEY_SYMBOL: TEMPLATE_KEY_SYMBOL
  });

  /**
   * Remove the child nodes from any DOM node
   * @param   {HTMLElement} node - target node
   * @returns {undefined}
   */
  function cleanNode(node) {
    clearChildren(node, node.childNodes);
  }
  /**
   * Clear multiple children in a node
   * @param   {HTMLElement} parent - parent node where the children will be removed
   * @param   {HTMLElement[]} children - direct children nodes
   * @returns {undefined}
   */


  function clearChildren(parent, children) {
    Array.from(children).forEach(n => parent.removeChild(n));
  }

  const EACH = 0;
  const IF = 1;
  const SIMPLE = 2;
  const TAG = 3;
  const SLOT = 4;
  var bindingTypes = {
    EACH,
    IF,
    SIMPLE,
    TAG,
    SLOT
  };
  /**
   * Create the template meta object in case of <template> fragments
   * @param   {TemplateChunk} componentTemplate - template chunk object
   * @returns {Object} the meta property that will be passed to the mount function of the TemplateChunk
   */

  function createTemplateMeta(componentTemplate) {
    const fragment = componentTemplate.dom.cloneNode(true);
    return {
      avoidDOMInjection: true,
      fragment,
      children: Array.from(fragment.childNodes)
    };
  }
  /* get rid of the @ungap/essential-map polyfill */


  const append = (get, parent, children, start, end, before) => {
    const isSelect = 'selectedIndex' in parent;
    let selectedIndex = -1;

    while (start < end) {
      const child = get(children[start], 1);
      if (isSelect && selectedIndex < 0 && child.selected) selectedIndex = start;
      parent.insertBefore(child, before);
      start++;
    }

    if (isSelect && -1 < selectedIndex) parent.selectedIndex = selectedIndex;
  };

  const eqeq = (a, b) => a == b;

  const identity = O => O;

  const indexOf = (moreNodes, moreStart, moreEnd, lessNodes, lessStart, lessEnd, compare) => {
    const length = lessEnd - lessStart;
    /* istanbul ignore if */

    if (length < 1) return -1;

    while (moreEnd - moreStart >= length) {
      let m = moreStart;
      let l = lessStart;

      while (m < moreEnd && l < lessEnd && compare(moreNodes[m], lessNodes[l])) {
        m++;
        l++;
      }

      if (l === lessEnd) return moreStart;
      moreStart = m + 1;
    }

    return -1;
  };

  const isReversed = (futureNodes, futureEnd, currentNodes, currentStart, currentEnd, compare) => {
    while (currentStart < currentEnd && compare(currentNodes[currentStart], futureNodes[futureEnd - 1])) {
      currentStart++;
      futureEnd--;
    }

    return futureEnd === 0;
  };

  const next = (get, list, i, length, before) => i < length ? get(list[i], 0) : 0 < i ? get(list[i - 1], -0).nextSibling : before;

  const remove = (get, parent, children, start, end) => {
    if (end - start < 2) parent.removeChild(get(children[start], -1));else {
      const range = parent.ownerDocument.createRange();
      range.setStartBefore(get(children[start], -1));
      range.setEndAfter(get(children[end - 1], -1));
      range.deleteContents();
    }
  }; // - - - - - - - - - - - - - - - - - - -
  // diff related constants and utilities
  // - - - - - - - - - - - - - - - - - - -


  const DELETION = -1;
  const INSERTION = 1;
  const SKIP = 0;
  const SKIP_OND = 50;

  const HS = (futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges) => {
    let k = 0;
    /* istanbul ignore next */

    let minLen = futureChanges < currentChanges ? futureChanges : currentChanges;
    const link = Array(minLen++);
    const tresh = Array(minLen);
    tresh[0] = -1;

    for (let i = 1; i < minLen; i++) tresh[i] = currentEnd;

    const keymap = new Map();

    for (let i = currentStart; i < currentEnd; i++) keymap.set(currentNodes[i], i);

    for (let i = futureStart; i < futureEnd; i++) {
      const idxInOld = keymap.get(futureNodes[i]);

      if (idxInOld != null) {
        k = findK(tresh, minLen, idxInOld);
        /* istanbul ignore else */

        if (-1 < k) {
          tresh[k] = idxInOld;
          link[k] = {
            newi: i,
            oldi: idxInOld,
            prev: link[k - 1]
          };
        }
      }
    }

    k = --minLen;
    --currentEnd;

    while (tresh[k] > currentEnd) --k;

    minLen = currentChanges + futureChanges - k;
    const diff = Array(minLen);
    let ptr = link[k];
    --futureEnd;

    while (ptr) {
      const {
        newi,
        oldi
      } = ptr;

      while (futureEnd > newi) {
        diff[--minLen] = INSERTION;
        --futureEnd;
      }

      while (currentEnd > oldi) {
        diff[--minLen] = DELETION;
        --currentEnd;
      }

      diff[--minLen] = SKIP;
      --futureEnd;
      --currentEnd;
      ptr = ptr.prev;
    }

    while (futureEnd >= futureStart) {
      diff[--minLen] = INSERTION;
      --futureEnd;
    }

    while (currentEnd >= currentStart) {
      diff[--minLen] = DELETION;
      --currentEnd;
    }

    return diff;
  }; // this is pretty much the same petit-dom code without the delete map part
  // https://github.com/yelouafi/petit-dom/blob/bd6f5c919b5ae5297be01612c524c40be45f14a7/src/vdom.js#L556-L561


  const OND = (futureNodes, futureStart, rows, currentNodes, currentStart, cols, compare) => {
    const length = rows + cols;
    const v = [];
    let d, k, r, c, pv, cv, pd;

    outer: for (d = 0; d <= length; d++) {
      /* istanbul ignore if */
      if (d > SKIP_OND) return null;
      pd = d - 1;
      /* istanbul ignore next */

      pv = d ? v[d - 1] : [0, 0];
      cv = v[d] = [];

      for (k = -d; k <= d; k += 2) {
        if (k === -d || k !== d && pv[pd + k - 1] < pv[pd + k + 1]) {
          c = pv[pd + k + 1];
        } else {
          c = pv[pd + k - 1] + 1;
        }

        r = c - k;

        while (c < cols && r < rows && compare(currentNodes[currentStart + c], futureNodes[futureStart + r])) {
          c++;
          r++;
        }

        if (c === cols && r === rows) {
          break outer;
        }

        cv[d + k] = c;
      }
    }

    const diff = Array(d / 2 + length / 2);
    let diffIdx = diff.length - 1;

    for (d = v.length - 1; d >= 0; d--) {
      while (c > 0 && r > 0 && compare(currentNodes[currentStart + c - 1], futureNodes[futureStart + r - 1])) {
        // diagonal edge = equality
        diff[diffIdx--] = SKIP;
        c--;
        r--;
      }

      if (!d) break;
      pd = d - 1;
      /* istanbul ignore next */

      pv = d ? v[d - 1] : [0, 0];
      k = c - r;

      if (k === -d || k !== d && pv[pd + k - 1] < pv[pd + k + 1]) {
        // vertical edge = insertion
        r--;
        diff[diffIdx--] = INSERTION;
      } else {
        // horizontal edge = deletion
        c--;
        diff[diffIdx--] = DELETION;
      }
    }

    return diff;
  };

  const applyDiff = (diff, get, parentNode, futureNodes, futureStart, currentNodes, currentStart, currentLength, before) => {
    const live = new Map();
    const length = diff.length;
    let currentIndex = currentStart;
    let i = 0;

    while (i < length) {
      switch (diff[i++]) {
        case SKIP:
          futureStart++;
          currentIndex++;
          break;

        case INSERTION:
          // TODO: bulk appends for sequential nodes
          live.set(futureNodes[futureStart], 1);
          append(get, parentNode, futureNodes, futureStart++, futureStart, currentIndex < currentLength ? get(currentNodes[currentIndex], 0) : before);
          break;

        case DELETION:
          currentIndex++;
          break;
      }
    }

    i = 0;

    while (i < length) {
      switch (diff[i++]) {
        case SKIP:
          currentStart++;
          break;

        case DELETION:
          // TODO: bulk removes for sequential nodes
          if (live.has(currentNodes[currentStart])) currentStart++;else remove(get, parentNode, currentNodes, currentStart++, currentStart);
          break;
      }
    }
  };

  const findK = (ktr, length, j) => {
    let lo = 1;
    let hi = length;

    while (lo < hi) {
      const mid = (lo + hi) / 2 >>> 0;
      if (j < ktr[mid]) hi = mid;else lo = mid + 1;
    }

    return lo;
  };

  const smartDiff = (get, parentNode, futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges, currentLength, compare, before) => {
    applyDiff(OND(futureNodes, futureStart, futureChanges, currentNodes, currentStart, currentChanges, compare) || HS(futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges), get, parentNode, futureNodes, futureStart, currentNodes, currentStart, currentLength, before);
  };
  /*! (c) 2018 Andrea Giammarchi (ISC) */


  const domdiff = (parentNode, // where changes happen
  currentNodes, // Array of current items/nodes
  futureNodes, // Array of future items/nodes
  options // optional object with one of the following properties
  //  before: domNode
  //  compare(generic, generic) => true if same generic
  //  node(generic) => Node
  ) => {
    if (!options) options = {};
    const compare = options.compare || eqeq;
    const get = options.node || identity;
    const before = options.before == null ? null : get(options.before, 0);
    const currentLength = currentNodes.length;
    let currentEnd = currentLength;
    let currentStart = 0;
    let futureEnd = futureNodes.length;
    let futureStart = 0; // common prefix

    while (currentStart < currentEnd && futureStart < futureEnd && compare(currentNodes[currentStart], futureNodes[futureStart])) {
      currentStart++;
      futureStart++;
    } // common suffix


    while (currentStart < currentEnd && futureStart < futureEnd && compare(currentNodes[currentEnd - 1], futureNodes[futureEnd - 1])) {
      currentEnd--;
      futureEnd--;
    }

    const currentSame = currentStart === currentEnd;
    const futureSame = futureStart === futureEnd; // same list

    if (currentSame && futureSame) return futureNodes; // only stuff to add

    if (currentSame && futureStart < futureEnd) {
      append(get, parentNode, futureNodes, futureStart, futureEnd, next(get, currentNodes, currentStart, currentLength, before));
      return futureNodes;
    } // only stuff to remove


    if (futureSame && currentStart < currentEnd) {
      remove(get, parentNode, currentNodes, currentStart, currentEnd);
      return futureNodes;
    }

    const currentChanges = currentEnd - currentStart;
    const futureChanges = futureEnd - futureStart;
    let i = -1; // 2 simple indels: the shortest sequence is a subsequence of the longest

    if (currentChanges < futureChanges) {
      i = indexOf(futureNodes, futureStart, futureEnd, currentNodes, currentStart, currentEnd, compare); // inner diff

      if (-1 < i) {
        append(get, parentNode, futureNodes, futureStart, i, get(currentNodes[currentStart], 0));
        append(get, parentNode, futureNodes, i + currentChanges, futureEnd, next(get, currentNodes, currentEnd, currentLength, before));
        return futureNodes;
      }
    }
    /* istanbul ignore else */
    else if (futureChanges < currentChanges) {
        i = indexOf(currentNodes, currentStart, currentEnd, futureNodes, futureStart, futureEnd, compare); // outer diff

        if (-1 < i) {
          remove(get, parentNode, currentNodes, currentStart, i);
          remove(get, parentNode, currentNodes, i + futureChanges, currentEnd);
          return futureNodes;
        }
      } // common case with one replacement for many nodes
    // or many nodes replaced for a single one

    /* istanbul ignore else */


    if (currentChanges < 2 || futureChanges < 2) {
      append(get, parentNode, futureNodes, futureStart, futureEnd, get(currentNodes[currentStart], 0));
      remove(get, parentNode, currentNodes, currentStart, currentEnd);
      return futureNodes;
    } // the half match diff part has been skipped in petit-dom
    // https://github.com/yelouafi/petit-dom/blob/bd6f5c919b5ae5297be01612c524c40be45f14a7/src/vdom.js#L391-L397
    // accordingly, I think it's safe to skip in here too
    // if one day it'll come out like the speediest thing ever to do
    // then I might add it in here too
    // Extra: before going too fancy, what about reversed lists ?
    //        This should bail out pretty quickly if that's not the case.


    if (currentChanges === futureChanges && isReversed(futureNodes, futureEnd, currentNodes, currentStart, currentEnd, compare)) {
      append(get, parentNode, futureNodes, futureStart, futureEnd, next(get, currentNodes, currentEnd, currentLength, before));
      return futureNodes;
    } // last resort through a smart diff


    smartDiff(get, parentNode, futureNodes, futureStart, futureEnd, futureChanges, currentNodes, currentStart, currentEnd, currentChanges, currentLength, compare, before);
    return futureNodes;
  };
  /**
   * Check if a value is null or undefined
   * @param   {*}  value - anything
   * @returns {boolean} true only for the 'undefined' and 'null' types
   */


  function isNil(value) {
    return value == null;
  }
  /**
   * Check if an element is a template tag
   * @param   {HTMLElement}  el - element to check
   * @returns {boolean} true if it's a <template>
   */


  function isTemplate(el) {
    return !isNil(el.content);
  }

  const EachBinding = Object.seal({
    // dynamic binding properties
    childrenMap: null,
    node: null,
    root: null,
    condition: null,
    evaluate: null,
    template: null,
    isTemplateTag: false,
    nodes: [],
    getKey: null,
    indexName: null,
    itemName: null,
    afterPlaceholder: null,
    placeholder: null,

    // API methods
    mount(scope, parentScope) {
      return this.update(scope, parentScope);
    },

    update(scope, parentScope) {
      const {
        placeholder
      } = this;
      const collection = this.evaluate(scope);
      const items = collection ? Array.from(collection) : [];
      const parent = placeholder.parentNode; // prepare the diffing

      const {
        newChildrenMap,
        batches,
        futureNodes
      } = createPatch(items, scope, parentScope, this); // patch the DOM only if there are new nodes

      if (futureNodes.length) {
        domdiff(parent, this.nodes, futureNodes, {
          before: placeholder,
          node: patch(Array.from(this.childrenMap.values()), parentScope)
        });
      } else {
        // remove all redundant templates
        unmountRedundant(this.childrenMap);
      } // trigger the mounts and the updates


      batches.forEach(fn => fn()); // update the children map

      this.childrenMap = newChildrenMap;
      this.nodes = futureNodes;
      return this;
    },

    unmount(scope, parentScope) {
      unmountRedundant(this.childrenMap, parentScope);
      this.childrenMap = new Map();
      this.nodes = [];
      return this;
    }

  });
  /**
   * Patch the DOM while diffing
   * @param   {TemplateChunk[]} redundant - redundant tepmplate chunks
   * @param   {*} parentScope - scope of the parent template
   * @returns {Function} patch function used by domdiff
   */

  function patch(redundant, parentScope) {
    return (item, info) => {
      if (info < 0) {
        const {
          template,
          context
        } = redundant.pop(); // notice that we pass null as last argument because
        // the root node and its children will be removed by domdiff

        template.unmount(context, parentScope, null);
      }

      return item;
    };
  }
  /**
   * Unmount the remaining template instances
   * @param   {Map} childrenMap - map containing the children template to unmount
   * @param   {*} parentScope - scope of the parent template
   * @returns {TemplateChunk[]} collection containing the template chunks unmounted
   */


  function unmountRedundant(childrenMap, parentScope) {
    return Array.from(childrenMap.values()).map((_ref) => {
      let {
        template,
        context
      } = _ref;
      return template.unmount(context, parentScope, true);
    });
  }
  /**
   * Check whether a template must be filtered from a loop
   * @param   {Function} condition - filter function
   * @param   {Object} context - argument passed to the filter function
   * @returns {boolean} true if this item should be skipped
   */


  function mustFilterItem(condition, context) {
    return condition ? Boolean(condition(context)) === false : false;
  }
  /**
   * Extend the scope of the looped template
   * @param   {Object} scope - current template scope
   * @param   {string} options.itemName - key to identify the looped item in the new context
   * @param   {string} options.indexName - key to identify the index of the looped item
   * @param   {number} options.index - current index
   * @param   {*} options.item - collection item looped
   * @returns {Object} enhanced scope object
   */


  function extendScope(scope, _ref2) {
    let {
      itemName,
      indexName,
      index,
      item
    } = _ref2;
    scope[itemName] = item;
    if (indexName) scope[indexName] = index;
    return scope;
  }
  /**
   * Loop the current template items
   * @param   {Array} items - expression collection value
   * @param   {*} scope - template scope
   * @param   {*} parentScope - scope of the parent template
   * @param   {EeachBinding} binding - each binding object instance
   * @returns {Object} data
   * @returns {Map} data.newChildrenMap - a Map containing the new children template structure
   * @returns {Array} data.batches - array containing the template lifecycle functions to trigger
   * @returns {Array} data.futureNodes - array containing the nodes we need to diff
   */


  function createPatch(items, scope, parentScope, binding) {
    const {
      condition,
      template,
      childrenMap,
      itemName,
      getKey,
      indexName,
      root,
      isTemplateTag
    } = binding;
    const newChildrenMap = new Map();
    const batches = [];
    const futureNodes = [];
    items.forEach((item, index) => {
      const context = extendScope(Object.create(scope), {
        itemName,
        indexName,
        index,
        item
      });
      const key = getKey ? getKey(context) : index;
      const oldItem = childrenMap.get(key);

      if (mustFilterItem(condition, context)) {
        return;
      }

      const componentTemplate = oldItem ? oldItem.template : template.clone();
      const el = oldItem ? componentTemplate.el : root.cloneNode();
      const mustMount = !oldItem;
      const meta = isTemplateTag && mustMount ? createTemplateMeta(componentTemplate) : {};

      if (mustMount) {
        batches.push(() => componentTemplate.mount(el, context, parentScope, meta));
      } else {
        componentTemplate.update(context, parentScope);
      } // create the collection of nodes to update or to add
      // in case of template tags we need to add all its children nodes


      if (isTemplateTag) {
        futureNodes.push(...(meta.children || componentTemplate.children));
      } else {
        futureNodes.push(el);
      } // delete the old item from the children map


      childrenMap.delete(key); // update the children map

      newChildrenMap.set(key, {
        template: componentTemplate,
        context,
        index
      });
    });
    return {
      newChildrenMap,
      batches,
      futureNodes
    };
  }

  function create(node, _ref3) {
    let {
      evaluate,
      condition,
      itemName,
      indexName,
      getKey,
      template
    } = _ref3;
    const placeholder = document.createTextNode('');
    const parent = node.parentNode;
    const root = node.cloneNode();
    parent.insertBefore(placeholder, node);
    parent.removeChild(node);
    return Object.assign({}, EachBinding, {
      childrenMap: new Map(),
      node,
      root,
      condition,
      evaluate,
      isTemplateTag: isTemplate(root),
      template: template.createDOM(node),
      getKey,
      indexName,
      itemName,
      placeholder
    });
  }
  /**
   * Binding responsible for the `if` directive
   */


  const IfBinding = Object.seal({
    // dynamic binding properties
    node: null,
    evaluate: null,
    parent: null,
    isTemplateTag: false,
    placeholder: null,
    template: null,

    // API methods
    mount(scope, parentScope) {
      this.parent.insertBefore(this.placeholder, this.node);
      this.parent.removeChild(this.node);
      return this.update(scope, parentScope);
    },

    update(scope, parentScope) {
      const value = !!this.evaluate(scope);
      const mustMount = !this.value && value;
      const mustUnmount = this.value && !value;

      switch (true) {
        case mustMount:
          this.parent.insertBefore(this.node, this.placeholder);
          this.template = this.template.clone();
          this.template.mount(this.node, scope, parentScope);
          break;

        case mustUnmount:
          this.unmount(scope);
          break;

        default:
          if (value) this.template.update(scope, parentScope);
      }

      this.value = value;
      return this;
    },

    unmount(scope, parentScope) {
      this.template.unmount(scope, parentScope, true);
      return this;
    }

  });

  function create$1(node, _ref4) {
    let {
      evaluate,
      template
    } = _ref4;
    return Object.assign({}, IfBinding, {
      node,
      evaluate,
      parent: node.parentNode,
      placeholder: document.createTextNode(''),
      template: template.createDOM(node)
    });
  }

  const ATTRIBUTE = 0;
  const EVENT = 1;
  const TEXT = 2;
  const VALUE = 3;
  var expressionTypes = {
    ATTRIBUTE,
    EVENT,
    TEXT,
    VALUE
  };
  const REMOVE_ATTRIBUTE = 'removeAttribute';
  const SET_ATTIBUTE = 'setAttribute';
  /**
   * Add all the attributes provided
   * @param   {HTMLElement} node - target node
   * @param   {Object} attributes - object containing the attributes names and values
   * @returns {undefined} sorry it's a void function :(
   */

  function setAllAttributes(node, attributes) {
    Object.entries(attributes).forEach((_ref5) => {
      let [name, value] = _ref5;
      return attributeExpression(node, {
        name
      }, value);
    });
  }
  /**
   * Remove all the attributes provided
   * @param   {HTMLElement} node - target node
   * @param   {Object} attributes - object containing all the attribute names
   * @returns {undefined} sorry it's a void function :(
   */


  function removeAllAttributes(node, attributes) {
    Object.keys(attributes).forEach(attribute => node.removeAttribute(attribute));
  }
  /**
   * This methods handles the DOM attributes updates
   * @param   {HTMLElement} node - target node
   * @param   {Object} expression - expression object
   * @param   {string} expression.name - attribute name
   * @param   {*} value - new expression value
   * @param   {*} oldValue - the old expression cached value
   * @returns {undefined}
   */


  function attributeExpression(node, _ref6, value, oldValue) {
    let {
      name
    } = _ref6;

    // is it a spread operator? {...attributes}
    if (!name) {
      // is the value still truthy?
      if (value) {
        setAllAttributes(node, value);
      } else if (oldValue) {
        // otherwise remove all the old attributes
        removeAllAttributes(node, oldValue);
      }

      return;
    } // handle boolean attributes


    if (typeof value === 'boolean') {
      node[name] = value;
    }

    node[getMethod(value)](name, normalizeValue(name, value));
  }
  /**
   * Get the attribute modifier method
   * @param   {*} value - if truthy we return `setAttribute` othewise `removeAttribute`
   * @returns {string} the node attribute modifier method name
   */


  function getMethod(value) {
    return isNil(value) || value === false || value === '' || typeof value === 'object' ? REMOVE_ATTRIBUTE : SET_ATTIBUTE;
  }
  /**
   * Get the value as string
   * @param   {string} name - attribute name
   * @param   {*} value - user input value
   * @returns {string} input value as string
   */


  function normalizeValue(name, value) {
    // be sure that expressions like selected={ true } will be always rendered as selected='selected'
    if (value === true) return name;
    return value;
  }
  /**
   * Set a new event listener
   * @param   {HTMLElement} node - target node
   * @param   {Object} expression - expression object
   * @param   {string} expression.name - event name
   * @param   {*} value - new expression value
   * @returns {undefined}
   */


  function eventExpression(node, _ref7, value) {
    let {
      name
    } = _ref7;
    node[name] = value;
  }
  /**
   * This methods handles a simple text expression update
   * @param   {HTMLElement} node - target node
   * @param   {Object} expression - expression object
   * @param   {number} expression.childNodeIndex - index to find the text node to update
   * @param   {*} value - new expression value
   * @returns {undefined}
   */


  function textExpression(node, _ref8, value) {
    let {
      childNodeIndex
    } = _ref8;
    const target = node.childNodes[childNodeIndex];
    const val = normalizeValue$1(value); // replace the target if it's a placeholder comment

    if (target.nodeType === Node.COMMENT_NODE) {
      const textNode = document.createTextNode(val);
      node.replaceChild(textNode, target);
    } else {
      target.data = normalizeValue$1(val);
    }
  }
  /**
   * Normalize the user value in order to render a empty string in case of falsy values
   * @param   {*} value - user input value
   * @returns {string} hopefully a string
   */


  function normalizeValue$1(value) {
    return value != null ? value : '';
  }
  /**
   * This methods handles the input fileds value updates
   * @param   {HTMLElement} node - target node
   * @param   {Object} expression - expression object
   * @param   {*} value - new expression value
   * @returns {undefined}
   */


  function valueExpression(node, expression, value) {
    node.value = value;
  }

  var expressions = {
    [ATTRIBUTE]: attributeExpression,
    [EVENT]: eventExpression,
    [TEXT]: textExpression,
    [VALUE]: valueExpression
  };
  const Expression = Object.seal({
    // Static props
    node: null,
    value: null,

    // API methods

    /**
     * Mount the expression evaluating its initial value
     * @param   {*} scope - argument passed to the expression to evaluate its current values
     * @returns {Expression} self
     */
    mount(scope) {
      // hopefully a pure function
      this.value = this.evaluate(scope); // IO() DOM updates

      apply(this, this.value);
      return this;
    },

    /**
     * Update the expression if its value changed
     * @param   {*} scope - argument passed to the expression to evaluate its current values
     * @returns {Expression} self
     */
    update(scope) {
      // pure function
      const value = this.evaluate(scope);

      if (this.value !== value) {
        // IO() DOM updates
        apply(this, value);
        this.value = value;
      }

      return this;
    },

    /**
     * Expression teardown method
     * @returns {Expression} self
     */
    unmount() {
      return this;
    }

  });
  /**
   * IO() function to handle the DOM updates
   * @param {Expression} expression - expression object
   * @param {*} value - current expression value
   * @returns {undefined}
   */

  function apply(expression, value) {
    return expressions[expression.type](expression.node, expression, value, expression.value);
  }

  function create$2(node, data) {
    return Object.assign({}, Expression, {}, data, {
      node
    });
  }
  /**
   * Create a flat object having as keys a list of methods that if dispatched will propagate
   * on the whole collection
   * @param   {Array} collection - collection to iterate
   * @param   {Array<string>} methods - methods to execute on each item of the collection
   * @param   {*} context - context returned by the new methods created
   * @returns {Object} a new object to simplify the the nested methods dispatching
   */


  function flattenCollectionMethods(collection, methods, context) {
    return methods.reduce((acc, method) => {
      return Object.assign({}, acc, {
        [method]: scope => {
          return collection.map(item => item[method](scope)) && context;
        }
      });
    }, {});
  }

  function create$3(node, _ref9) {
    let {
      expressions
    } = _ref9;
    return Object.assign({}, flattenCollectionMethods(expressions.map(expression => create$2(node, expression)), ['mount', 'update', 'unmount']));
  }

  const SlotBinding = Object.seal({
    // dynamic binding properties
    node: null,
    name: null,
    template: null,

    // API methods
    mount(scope, parentScope) {
      const templateData = scope.slots ? scope.slots.find((_ref10) => {
        let {
          id
        } = _ref10;
        return id === this.name;
      }) : false;
      const {
        parentNode
      } = this.node;
      this.template = templateData && create$6(templateData.html, templateData.bindings).createDOM(parentNode);

      if (this.template) {
        this.template.mount(this.node, parentScope);
        moveSlotInnerContent(this.node);
      }

      parentNode.removeChild(this.node);
      return this;
    },

    update(scope, parentScope) {
      if (this.template && parentScope) {
        this.template.update(parentScope);
      }

      return this;
    },

    unmount(scope, parentScope, mustRemoveRoot) {
      if (this.template) {
        this.template.unmount(parentScope, null, mustRemoveRoot);
      }

      return this;
    }

  });
  /**
   * Move the inner content of the slots outside of them
   * @param   {HTMLNode} slot - slot node
   * @returns {undefined} it's a void function
   */

  function moveSlotInnerContent(slot) {
    if (slot.firstChild) {
      slot.parentNode.insertBefore(slot.firstChild, slot);
      moveSlotInnerContent(slot);
    }
  }
  /**
   * Create a single slot binding
   * @param   {HTMLElement} node - slot node
   * @param   {string} options.name - slot id
   * @returns {Object} Slot binding object
   */


  function createSlot(node, _ref11) {
    let {
      name
    } = _ref11;
    return Object.assign({}, SlotBinding, {
      node,
      name
    });
  }
  /**
   * Create a new tag object if it was registered before, otherwise fallback to the simple
   * template chunk
   * @param   {Function} component - component factory function
   * @param   {Array<Object>} slots - array containing the slots markup
   * @param   {Array} attributes - dynamic attributes that will be received by the tag element
   * @returns {TagImplementation|TemplateChunk} a tag implementation or a template chunk as fallback
   */


  function getTag(component, slots, attributes) {
    if (slots === void 0) {
      slots = [];
    }

    if (attributes === void 0) {
      attributes = [];
    }

    // if this tag was registered before we will return its implementation
    if (component) {
      return component({
        slots,
        attributes
      });
    } // otherwise we return a template chunk


    return create$6(slotsToMarkup(slots), [...slotBindings(slots), {
      // the attributes should be registered as binding
      // if we fallback to a normal template chunk
      expressions: attributes.map(attr => {
        return Object.assign({
          type: ATTRIBUTE
        }, attr);
      })
    }]);
  }
  /**
   * Merge all the slots bindings into a single array
   * @param   {Array<Object>} slots - slots collection
   * @returns {Array<Bindings>} flatten bindings array
   */


  function slotBindings(slots) {
    return slots.reduce((acc, _ref12) => {
      let {
        bindings
      } = _ref12;
      return acc.concat(bindings);
    }, []);
  }
  /**
   * Merge all the slots together in a single markup string
   * @param   {Array<Object>} slots - slots collection
   * @returns {string} markup of all the slots in a single string
   */


  function slotsToMarkup(slots) {
    return slots.reduce((acc, slot) => {
      return acc + slot.html;
    }, '');
  }

  const TagBinding = Object.seal({
    // dynamic binding properties
    node: null,
    evaluate: null,
    name: null,
    slots: null,
    tag: null,
    attributes: null,
    getComponent: null,

    mount(scope) {
      return this.update(scope);
    },

    update(scope, parentScope) {
      const name = this.evaluate(scope); // simple update

      if (name === this.name) {
        this.tag.update(scope);
      } else {
        // unmount the old tag if it exists
        this.unmount(scope, parentScope, true); // mount the new tag

        this.name = name;
        this.tag = getTag(this.getComponent(name), this.slots, this.attributes);
        this.tag.mount(this.node, scope);
      }

      return this;
    },

    unmount(scope, parentScope, keepRootTag) {
      if (this.tag) {
        // keep the root tag
        this.tag.unmount(keepRootTag);
      }

      return this;
    }

  });

  function create$4(node, _ref13) {
    let {
      evaluate,
      getComponent,
      slots,
      attributes
    } = _ref13;
    return Object.assign({}, TagBinding, {
      node,
      evaluate,
      slots,
      attributes,
      getComponent
    });
  }

  var bindings = {
    [IF]: create$1,
    [SIMPLE]: create$3,
    [EACH]: create,
    [TAG]: create$4,
    [SLOT]: createSlot
  };
  /**
   * Bind a new expression object to a DOM node
   * @param   {HTMLElement} root - DOM node where to bind the expression
   * @param   {Object} binding - binding data
   * @returns {Expression} Expression object
   */

  function create$5(root, binding) {
    const {
      selector,
      type,
      redundantAttribute,
      expressions
    } = binding; // find the node to apply the bindings

    const node = selector ? root.querySelector(selector) : root; // remove eventually additional attributes created only to select this node

    if (redundantAttribute) node.removeAttribute(redundantAttribute); // init the binding

    return (bindings[type] || bindings[SIMPLE])(node, Object.assign({}, binding, {
      expressions: expressions || []
    }));
  }
  /**
   * Check if an element is part of an svg
   * @param   {HTMLElement}  el - element to check
   * @returns {boolean} true if we are in an svg context
   */


  function isSvg(el) {
    const owner = el.ownerSVGElement;
    return !!owner || owner === null;
  } // in this case a simple innerHTML is enough


  function createHTMLTree(html, root) {
    const template = isTemplate(root) ? root : document.createElement('template');
    template.innerHTML = html;
    return template.content;
  } // for svg nodes we need a bit more work


  function creteSVGTree(html, container) {
    // create the SVGNode
    const svgNode = container.ownerDocument.importNode(new window.DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`, 'application/xml').documentElement, true);
    return svgNode;
  }
  /**
   * Create the DOM that will be injected
   * @param {Object} root - DOM node to find out the context where the fragment will be created
   * @param   {string} html - DOM to create as string
   * @returns {HTMLDocumentFragment|HTMLElement} a new html fragment
   */


  function createDOMTree(root, html) {
    if (isSvg(root)) return creteSVGTree(html, root);
    return createHTMLTree(html, root);
  }
  /**
   * Move all the child nodes from a source tag to another
   * @param   {HTMLElement} source - source node
   * @param   {HTMLElement} target - target node
   * @returns {undefined} it's a void method ¯\_(ツ)_/¯
   */
  // Ignore this helper because it's needed only for svg tags

  /* istanbul ignore next */


  function moveChildren(source, target) {
    if (source.firstChild) {
      target.appendChild(source.firstChild);
      moveChildren(source, target);
    }
  }
  /**
   * Inject the DOM tree into a target node
   * @param   {HTMLElement} el - target element
   * @param   {HTMLFragment|SVGElement} dom - dom tree to inject
   * @returns {undefined}
   */


  function injectDOM(el, dom) {
    switch (true) {
      case isSvg(el):
        moveChildren(dom, el);
        break;

      case isTemplate(el):
        el.parentNode.replaceChild(dom, el);
        break;

      default:
        el.appendChild(dom);
    }
  }
  /**
   * Create the Template DOM skeleton
   * @param   {HTMLElement} el - root node where the DOM will be injected
   * @param   {string} html - markup that will be injected into the root node
   * @returns {HTMLFragment} fragment that will be injected into the root node
   */


  function createTemplateDOM(el, html) {
    return html && (typeof html === 'string' ? createDOMTree(el, html) : html);
  }
  /**
   * Template Chunk model
   * @type {Object}
   */


  const TemplateChunk = Object.freeze({
    // Static props
    bindings: null,
    bindingsData: null,
    html: null,
    isTemplateTag: false,
    fragment: null,
    children: null,
    dom: null,
    el: null,

    /**
     * Create the template DOM structure that will be cloned on each mount
     * @param   {HTMLElement} el - the root node
     * @returns {TemplateChunk} self
     */
    createDOM(el) {
      // make sure that the DOM gets created before cloning the template
      this.dom = this.dom || createTemplateDOM(el, this.html);
      return this;
    },

    // API methods

    /**
     * Attach the template to a DOM node
     * @param   {HTMLElement} el - target DOM node
     * @param   {*} scope - template data
     * @param   {*} parentScope - scope of the parent template tag
     * @param   {Object} meta - meta properties needed to handle the <template> tags in loops
     * @returns {TemplateChunk} self
     */
    mount(el, scope, parentScope, meta) {
      if (meta === void 0) {
        meta = {};
      }

      if (!el) throw new Error('Please provide DOM node to mount properly your template');
      if (this.el) this.unmount(scope); // <template> tags require a bit more work
      // the template fragment might be already created via meta outside of this call

      const {
        fragment,
        children,
        avoidDOMInjection
      } = meta; // <template> bindings of course can not have a root element
      // so we check the parent node to set the query selector bindings

      const {
        parentNode
      } = children ? children[0] : el;
      this.isTemplateTag = isTemplate(el); // create the DOM if it wasn't created before

      this.createDOM(el);

      if (this.dom) {
        // create the new template dom fragment if it want already passed in via meta
        this.fragment = fragment || this.dom.cloneNode(true);
      } // store root node
      // notice that for template tags the root note will be the parent tag


      this.el = this.isTemplateTag ? parentNode : el; // create the children array only for the <template> fragments

      this.children = this.isTemplateTag ? children || Array.from(this.fragment.childNodes) : null; // inject the DOM into the el only if a fragment is available

      if (!avoidDOMInjection && this.fragment) injectDOM(el, this.fragment); // create the bindings

      this.bindings = this.bindingsData.map(binding => create$5(this.el, binding));
      this.bindings.forEach(b => b.mount(scope, parentScope));
      return this;
    },

    /**
     * Update the template with fresh data
     * @param   {*} scope - template data
     * @param   {*} parentScope - scope of the parent template tag
     * @returns {TemplateChunk} self
     */
    update(scope, parentScope) {
      this.bindings.forEach(b => b.update(scope, parentScope));
      return this;
    },

    /**
     * Remove the template from the node where it was initially mounted
     * @param   {*} scope - template data
     * @param   {*} parentScope - scope of the parent template tag
     * @param   {boolean|null} mustRemoveRoot - if true remove the root element,
     * if false or undefined clean the root tag content, if null don't touch the DOM
     * @returns {TemplateChunk} self
     */
    unmount(scope, parentScope, mustRemoveRoot) {
      if (this.el) {
        this.bindings.forEach(b => b.unmount(scope, parentScope, mustRemoveRoot));

        if (mustRemoveRoot && this.el.parentNode) {
          this.el.parentNode.removeChild(this.el);
        }

        if (mustRemoveRoot !== null) {
          if (this.children) {
            clearChildren(this.children[0].parentNode, this.children);
          } else {
            cleanNode(this.el);
          }
        }

        this.el = null;
      }

      return this;
    },

    /**
     * Clone the template chunk
     * @returns {TemplateChunk} a clone of this object resetting the this.el property
     */
    clone() {
      return Object.assign({}, this, {
        el: null
      });
    }

  });
  /**
   * Create a template chunk wiring also the bindings
   * @param   {string|HTMLElement} html - template string
   * @param   {Array} bindings - bindings collection
   * @returns {TemplateChunk} a new TemplateChunk copy
   */

  function create$6(html, bindings) {
    if (bindings === void 0) {
      bindings = [];
    }

    return Object.assign({}, TemplateChunk, {
      html,
      bindingsData: bindings
    });
  }

  /**
   * Quick type checking
   * @param   {*} element - anything
   * @param   {string} type - type definition
   * @returns {boolean} true if the type corresponds
   */
  function checkType(element, type) {
    return typeof element === type;
  }
  /**
   * Check that will be passed if its argument is a function
   * @param   {*} value - value to check
   * @returns {boolean} - true if the value is a function
   */

  function isFunction(value) {
    return checkType(value, 'function');
  }

  /* eslint-disable fp/no-mutating-methods */
  /**
   * Throw an error
   * @param {string} error - error message
   * @returns {undefined} it's a IO void function
   */

  function panic(error) {
    throw new Error(error);
  }
  /**
   * Call the first argument received only if it's a function otherwise return it as it is
   * @param   {*} source - anything
   * @returns {*} anything
   */

  function callOrAssign(source) {
    return isFunction(source) ? source.prototype && source.prototype.constructor ? new source() : source() : source;
  }
  /**
   * Convert a string from camel case to dash-case
   * @param   {string} string - probably a component tag name
   * @returns {string} component name normalized
   */

  function camelToDashCase(string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
  /**
   * Convert a string containing dashes to camel case
   * @param   {string} string - input string
   * @returns {string} my-string -> myString
   */

  function dashToCamelCase(string) {
    return string.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  }
  /**
   * Define default properties if they don't exist on the source object
   * @param   {Object} source - object that will receive the default properties
   * @param   {Object} defaults - object containing additional optional keys
   * @returns {Object} the original object received enhanced
   */

  function defineDefaults(source, defaults) {
    Object.entries(defaults).forEach((_ref) => {
      let [key, value] = _ref;
      if (!source[key]) source[key] = value;
    });
    return source;
  } // doese simply nothing

  function noop() {
    return this;
  }
  /**
   * Autobind the methods of a source object to itself
   * @param   {Object} source - probably a riot tag instance
   * @param   {Array<string>} methods - list of the methods to autobind
   * @returns {Object} the original object received
   */

  function autobindMethods(source, methods) {
    methods.forEach(method => {
      source[method] = source[method].bind(source);
    });
    return source;
  }
  /**
   * Helper function to set an immutable property
   * @param   {Object} source - object where the new property will be set
   * @param   {string} key - object key where the new property will be stored
   * @param   {*} value - value of the new property
   * @param   {Object} options - set the propery overriding the default options
   * @returns {Object} - the original object modified
   */

  function defineProperty(source, key, value, options) {
    if (options === void 0) {
      options = {};
    }

    Object.defineProperty(source, key, Object.assign({
      value,
      enumerable: false,
      writable: false,
      configurable: true
    }, options));
    return source;
  }
  /**
   * Define multiple properties on a target object
   * @param   {Object} source - object where the new properties will be set
   * @param   {Object} properties - object containing as key pair the key + value properties
   * @param   {Object} options - set the propery overriding the default options
   * @returns {Object} the original object modified
   */

  function defineProperties(source, properties, options) {
    Object.entries(properties).forEach((_ref2) => {
      let [key, value] = _ref2;
      defineProperty(source, key, value, options);
    });
    return source;
  }
  /**
   * Evaluate a list of attribute expressions
   * @param   {Array} attributes - attribute expressions generated by the riot compiler
   * @returns {Object} key value pairs with the result of the computation
   */

  function evaluateAttributeExpressions(attributes) {
    return attributes.reduce((acc, attribute) => {
      const {
        value,
        type
      } = attribute;

      switch (true) {
        // spread attribute
        case !attribute.name && type === expressionTypes.ATTRIBUTE:
          return Object.assign({}, acc, {}, value);
        // value attribute

        case type === expressionTypes.VALUE:
          acc[VALUE_ATTRIBUTE] = attribute.value;
          break;
        // normal attributes

        default:
          acc[dashToCamelCase(attribute.name)] = attribute.value;
      }

      return acc;
    }, {});
  }

  /**
   * Converts any DOM node/s to a loopable array
   * @param   { HTMLElement|NodeList } els - single html element or a node list
   * @returns { Array } always a loopable object
   */
  function domToArray(els) {
    // can this object be already looped?
    if (!Array.isArray(els)) {
      // is it a node list?
      if (/^\[object (HTMLCollection|NodeList|Object)\]$/.test(Object.prototype.toString.call(els)) && typeof els.length === 'number') return Array.from(els);else // if it's a single node
        // it will be returned as "array" with one single entry
        return [els];
    } // this object could be looped out of the box


    return els;
  }

  /**
   * Normalize the return values, in case of a single value we avoid to return an array
   * @param   { Array } values - list of values we want to return
   * @returns { Array|string|boolean } either the whole list of values or the single one found
   * @private
   */

  const normalize = values => values.length === 1 ? values[0] : values;
  /**
   * Parse all the nodes received to get/remove/check their attributes
   * @param   { HTMLElement|NodeList|Array } els    - DOM node/s to parse
   * @param   { string|Array }               name   - name or list of attributes
   * @param   { string }                     method - method that will be used to parse the attributes
   * @returns { Array|string } result of the parsing in a list or a single value
   * @private
   */


  function parseNodes(els, name, method) {
    const names = typeof name === 'string' ? [name] : name;
    return normalize(domToArray(els).map(el => {
      return normalize(names.map(n => el[method](n)));
    }));
  }
  /**
   * Set any attribute on a single or a list of DOM nodes
   * @param   { HTMLElement|NodeList|Array } els   - DOM node/s to parse
   * @param   { string|Object }              name  - either the name of the attribute to set
   *                                                 or a list of properties as object key - value
   * @param   { string }                     value - the new value of the attribute (optional)
   * @returns { HTMLElement|NodeList|Array } the original array of elements passed to this function
   *
   * @example
   *
   * import { set } from 'bianco.attr'
   *
   * const img = document.createElement('img')
   *
   * set(img, 'width', 100)
   *
   * // or also
   * set(img, {
   *   width: 300,
   *   height: 300
   * })
   *
   */


  function set(els, name, value) {
    const attrs = typeof name === 'object' ? name : {
      [name]: value
    };
    const props = Object.keys(attrs);
    domToArray(els).forEach(el => {
      props.forEach(prop => el.setAttribute(prop, attrs[prop]));
    });
    return els;
  }
  /**
   * Get any attribute from a single or a list of DOM nodes
   * @param   { HTMLElement|NodeList|Array } els   - DOM node/s to parse
   * @param   { string|Array }               name  - name or list of attributes to get
   * @returns { Array|string } list of the attributes found
   *
   * @example
   *
   * import { get } from 'bianco.attr'
   *
   * const img = document.createElement('img')
   *
   * get(img, 'width') // => '200'
   *
   * // or also
   * get(img, ['width', 'height']) // => ['200', '300']
   *
   * // or also
   * get([img1, img2], ['width', 'height']) // => [['200', '300'], ['500', '200']]
   */

  function get(els, name) {
    return parseNodes(els, name, 'getAttribute');
  }

  /**
   * Get all the element attributes as object
   * @param   {HTMLElement} element - DOM node we want to parse
   * @returns {Object} all the attributes found as a key value pairs
   */

  function DOMattributesToObject(element) {
    return Array.from(element.attributes).reduce((acc, attribute) => {
      acc[dashToCamelCase(attribute.name)] = attribute.value;
      return acc;
    }, {});
  }
  /**
   * Get the tag name of any DOM node
   * @param   {HTMLElement} element - DOM node we want to inspect
   * @returns {string} name to identify this dom node in riot
   */

  function getName(element) {
    return get(element, IS_DIRECTIVE) || element.tagName.toLowerCase();
  }

  /**
   * Simple helper to find DOM nodes returning them as array like loopable object
   * @param   { string|DOMNodeList } selector - either the query or the DOM nodes to arraify
   * @param   { HTMLElement }        ctx      - context defining where the query will search for the DOM nodes
   * @returns { Array } DOM nodes found as array
   */

  function $(selector, ctx) {
    return domToArray(typeof selector === 'string' ? (ctx || document).querySelectorAll(selector) : selector);
  }

  const CSS_BY_NAME = new Map();
  const STYLE_NODE_SELECTOR = 'style[riot]'; // memoized curried function

  const getStyleNode = (style => {
    return () => {
      // lazy evaluation:
      // if this function was already called before
      // we return its cached result
      if (style) return style; // create a new style element or use an existing one
      // and cache it internally

      style = $(STYLE_NODE_SELECTOR)[0] || document.createElement('style');
      set(style, 'type', 'text/css');
      /* istanbul ignore next */

      if (!style.parentNode) document.head.appendChild(style);
      return style;
    };
  })();
  /**
   * Object that will be used to inject and manage the css of every tag instance
   */


  var cssManager = {
    CSS_BY_NAME,

    /**
     * Save a tag style to be later injected into DOM
     * @param { string } name - if it's passed we will map the css to a tagname
     * @param { string } css - css string
     * @returns {Object} self
     */
    add(name, css) {
      if (!CSS_BY_NAME.has(name)) {
        CSS_BY_NAME.set(name, css);
        this.inject();
      }

      return this;
    },

    /**
     * Inject all previously saved tag styles into DOM
     * innerHTML seems slow: http://jsperf.com/riot-insert-style
     * @returns {Object} self
     */
    inject() {
      getStyleNode().innerHTML = [...CSS_BY_NAME.values()].join('\n');
      return this;
    },

    /**
     * Remove a tag style from the DOM
     * @param {string} name a registered tagname
     * @returns {Object} self
     */
    remove(name) {
      if (CSS_BY_NAME.has(name)) {
        CSS_BY_NAME.delete(name);
        this.inject();
      }

      return this;
    }

  };

  /**
   * Function to curry any javascript method
   * @param   {Function}  fn - the target function we want to curry
   * @param   {...[args]} acc - initial arguments
   * @returns {Function|*} it will return a function until the target function
   *                       will receive all of its arguments
   */
  function curry(fn) {
    for (var _len = arguments.length, acc = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      acc[_key - 1] = arguments[_key];
    }

    return function () {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      args = [...acc, ...args];
      return args.length < fn.length ? curry(fn, ...args) : fn(...args);
    };
  }

  const COMPONENT_CORE_HELPERS = Object.freeze({
    // component helpers
    $(selector) {
      return $(selector, this.root)[0];
    },

    $$(selector) {
      return $(selector, this.root);
    }

  });
  const COMPONENT_LIFECYCLE_METHODS = Object.freeze({
    shouldUpdate: noop,
    onBeforeMount: noop,
    onMounted: noop,
    onBeforeUpdate: noop,
    onUpdated: noop,
    onBeforeUnmount: noop,
    onUnmounted: noop
  });
  const MOCKED_TEMPLATE_INTERFACE = {
    update: noop,
    mount: noop,
    unmount: noop,
    clone: noop,
    createDOM: noop
    /**
     * Factory function to create the component templates only once
     * @param   {Function} template - component template creation function
     * @param   {Object} components - object containing the nested components
     * @returns {TemplateChunk} template chunk object
     */

  };

  function componentTemplateFactory(template, components) {
    return template(create$6, expressionTypes, bindingTypes, name => {
      return components[name] || COMPONENTS_IMPLEMENTATION_MAP.get(name);
    });
  }
  /**
   * Create the component interface needed for the @riotjs/dom-bindings tag bindings
   * @param   {string} options.css - component css
   * @param   {Function} options.template - functon that will return the dom-bindings template function
   * @param   {Object} options.exports - component interface
   * @param   {string} options.name - component name
   * @returns {Object} component like interface
   */


  function createComponent(_ref) {
    let {
      css,
      template,
      exports,
      name
    } = _ref;
    const templateFn = template ? componentTemplateFactory(template, exports ? createSubcomponents(exports.components) : {}) : MOCKED_TEMPLATE_INTERFACE;
    return (_ref2) => {
      let {
        slots,
        attributes,
        props
      } = _ref2;
      const componentAPI = callOrAssign(exports) || {};
      const component = defineComponent({
        css,
        template: templateFn,
        componentAPI,
        name
      })({
        slots,
        attributes,
        props
      }); // notice that for the components create via tag binding
      // we need to invert the mount (state/parentScope) arguments
      // the template bindings will only forward the parentScope updates
      // and never deal with the component state

      return {
        mount(element, parentScope, state) {
          return component.mount(element, state, parentScope);
        },

        update(parentScope, state) {
          return component.update(state, parentScope);
        },

        unmount(preserveRoot) {
          return component.unmount(preserveRoot);
        }

      };
    };
  }
  /**
   * Component definition function
   * @param   {Object} implementation - the componen implementation will be generated via compiler
   * @param   {Object} component - the component initial properties
   * @returns {Object} a new component implementation object
   */

  function defineComponent(_ref3) {
    let {
      css,
      template,
      componentAPI,
      name
    } = _ref3;
    // add the component css into the DOM
    if (css && name) cssManager.add(name, css);
    return curry(enhanceComponentAPI)(defineProperties( // set the component defaults without overriding the original component API
    defineDefaults(componentAPI, Object.assign({}, COMPONENT_LIFECYCLE_METHODS, {
      state: {}
    })), Object.assign({
      // defined during the component creation
      slots: null,
      root: null
    }, COMPONENT_CORE_HELPERS, {
      name,
      css,
      template
    })));
  }
  /**
   * Evaluate the component properties either from its real attributes or from its attribute expressions
   * @param   {HTMLElement} element - component root
   * @param   {Array}  attributeExpressions - attribute values generated via createAttributeBindings
   * @returns {Object} attributes key value pairs
   */

  function evaluateProps(element, attributeExpressions) {
    if (attributeExpressions === void 0) {
      attributeExpressions = [];
    }

    return Object.assign({}, DOMattributesToObject(element), {}, evaluateAttributeExpressions(attributeExpressions));
  }
  /**
   * Create the bindings to update the component attributes
   * @param   {HTMLElement} node - node where we will bind the expressions
   * @param   {Array} attributes - list of attribute bindings
   * @returns {TemplateChunk} - template bindings object
   */


  function createAttributeBindings(node, attributes) {
    if (attributes === void 0) {
      attributes = [];
    }

    const expressions = attributes.map(a => create$2(node, a));
    const binding = {};

    const updateValues = method => scope => {
      expressions.forEach(e => e[method](scope));
      return binding;
    };

    return Object.assign(binding, {
      expressions,
      mount: updateValues('mount'),
      update: updateValues('update'),
      unmount: updateValues('unmount')
    });
  }
  /**
   * Create the subcomponents that can be included inside a tag in runtime
   * @param   {Object} components - components imported in runtime
   * @returns {Object} all the components transformed into Riot.Component factory functions
   */


  function createSubcomponents(components) {
    if (components === void 0) {
      components = {};
    }

    return Object.entries(callOrAssign(components)).reduce((acc, _ref4) => {
      let [key, value] = _ref4;
      acc[camelToDashCase(key)] = createComponent(value);
      return acc;
    }, {});
  }
  /**
   * Run the component instance through all the plugins set by the user
   * @param   {Object} component - component instance
   * @returns {Object} the component enhanced by the plugins
   */


  function runPlugins(component) {
    return [...PLUGINS_SET].reduce((c, fn) => fn(c) || c, component);
  }
  /**
   * Compute the component current state merging it with its previous state
   * @param   {Object} oldState - previous state object
   * @param   {Object} newState - new state givent to the `update` call
   * @returns {Object} new object state
   */


  function computeState(oldState, newState) {
    return Object.assign({}, oldState, {}, callOrAssign(newState));
  }
  /**
   * Add eventually the "is" attribute to link this DOM node to its css
   * @param {HTMLElement} element - target root node
   * @param {string} name - name of the component mounted
   * @returns {undefined} it's a void function
   */


  function addCssHook(element, name) {
    if (getName(element) !== name) {
      set(element, 'is', name);
    }
  }
  /**
   * Component creation factory function that will enhance the user provided API
   * @param   {Object} component - a component implementation previously defined
   * @param   {Array} options.slots - component slots generated via riot compiler
   * @param   {Array} options.attributes - attribute expressions generated via riot compiler
   * @returns {Riot.Component} a riot component instance
   */


  function enhanceComponentAPI(component, _ref5) {
    let {
      slots,
      attributes,
      props
    } = _ref5;
    const initialProps = callOrAssign(props);
    return autobindMethods(runPlugins(defineProperties(Object.create(component), {
      mount(element, state, parentScope) {
        if (state === void 0) {
          state = {};
        }

        this[ATTRIBUTES_KEY_SYMBOL] = createAttributeBindings(element, attributes).mount(parentScope);
        this.props = Object.freeze(Object.assign({}, initialProps, {}, evaluateProps(element, this[ATTRIBUTES_KEY_SYMBOL].expressions)));
        this.state = computeState(this.state, state);
        this[TEMPLATE_KEY_SYMBOL] = this.template.createDOM(element).clone(); // link this object to the DOM node

        element[DOM_COMPONENT_INSTANCE_PROPERTY] = this; // add eventually the 'is' attribute

        component.name && addCssHook(element, component.name); // define the root element

        defineProperty(this, 'root', element); // define the slots array

        defineProperty(this, 'slots', slots); // before mount lifecycle event

        this.onBeforeMount(this.props, this.state); // mount the template

        this[TEMPLATE_KEY_SYMBOL].mount(element, this, parentScope);
        this.onMounted(this.props, this.state);
        return this;
      },

      update(state, parentScope) {
        if (state === void 0) {
          state = {};
        }

        if (parentScope) {
          this[ATTRIBUTES_KEY_SYMBOL].update(parentScope);
        }

        const newProps = evaluateProps(this.root, this[ATTRIBUTES_KEY_SYMBOL].expressions);
        if (this.shouldUpdate(newProps, this.props) === false) return;
        this.props = Object.freeze(Object.assign({}, initialProps, {}, newProps));
        this.state = computeState(this.state, state);
        this.onBeforeUpdate(this.props, this.state);
        this[TEMPLATE_KEY_SYMBOL].update(this, parentScope);
        this.onUpdated(this.props, this.state);
        return this;
      },

      unmount(preserveRoot) {
        this.onBeforeUnmount(this.props, this.state);
        this[ATTRIBUTES_KEY_SYMBOL].unmount(); // if the preserveRoot is null the template html will be left untouched
        // in that case the DOM cleanup will happen differently from a parent node

        this[TEMPLATE_KEY_SYMBOL].unmount(this, {}, preserveRoot === null ? null : !preserveRoot);
        this.onUnmounted(this.props, this.state);
        return this;
      }

    })), Object.keys(component).filter(prop => isFunction(component[prop])));
  }
  /**
   * Component initialization function starting from a DOM node
   * @param   {HTMLElement} element - element to upgrade
   * @param   {Object} initialProps - initial component properties
   * @param   {string} componentName - component id
   * @returns {Object} a new component instance bound to a DOM node
   */

  function mountComponent(element, initialProps, componentName) {
    const name = componentName || getName(element);
    if (!COMPONENTS_IMPLEMENTATION_MAP.has(name)) panic(`The component named "${name}" was never registered`);
    const component = COMPONENTS_IMPLEMENTATION_MAP.get(name)({
      props: initialProps
    });
    return component.mount(element);
  }

  /**
   * Similar to compose but performs from left-to-right function composition.<br/>
   * {@link https://30secondsofcode.org/function#composeright see also}
   * @param   {...[function]} fns) - list of unary function
   * @returns {*} result of the computation
   */
  /**
   * Performs right-to-left function composition.<br/>
   * Use Array.prototype.reduce() to perform right-to-left function composition.<br/>
   * The last (rightmost) function can accept one or more arguments; the remaining functions must be unary.<br/>
   * {@link https://30secondsofcode.org/function#compose original source code}
   * @param   {...[function]} fns) - list of unary function
   * @returns {*} result of the computation
   */

  function compose() {
    for (var _len2 = arguments.length, fns = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      fns[_key2] = arguments[_key2];
    }

    return fns.reduce((f, g) => function () {
      return f(g(...arguments));
    });
  }

  const {
    DOM_COMPONENT_INSTANCE_PROPERTY: DOM_COMPONENT_INSTANCE_PROPERTY$1,
    COMPONENTS_IMPLEMENTATION_MAP: COMPONENTS_IMPLEMENTATION_MAP$1,
    PLUGINS_SET: PLUGINS_SET$1
  } = globals;
  /**
   * Riot public api
   */

  /**
   * Register a custom tag by name
   * @param   {string} name - component name
   * @param   {Object} implementation - tag implementation
   * @returns {Map} map containing all the components implementations
   */

  function register(name, _ref) {
    let {
      css,
      template,
      exports
    } = _ref;
    if (COMPONENTS_IMPLEMENTATION_MAP$1.has(name)) panic(`The component "${name}" was already registered`);
    COMPONENTS_IMPLEMENTATION_MAP$1.set(name, createComponent({
      name,
      css,
      template,
      exports
    }));
    return COMPONENTS_IMPLEMENTATION_MAP$1;
  }
  /**
   * Mounting function that will work only for the components that were globally registered
   * @param   {string|HTMLElement} selector - query for the selection or a DOM element
   * @param   {Object} initialProps - the initial component properties
   * @param   {string} name - optional component name
   * @returns {Array} list of nodes upgraded
   */

  function mount(selector, initialProps, name) {
    return $(selector).map(element => mountComponent(element, initialProps, name));
  }
  /**
   * Helpter method to create component without relying on the registered ones
   * @param   {Object} implementation - component implementation
   * @returns {Function} function that will allow you to mount a riot component on a DOM node
   */

  function component(implementation) {
    return (el, props) => compose(c => c.mount(el), c => c({
      props
    }), createComponent)(implementation);
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

  function normalize$1(path) {
    return path.replace(/^\/|\/$/, '')
  }

  function isString(str) {
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

    path = route._.base + normalize$1(path);
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
    if (isString(first) && (!second || isString(second))) { go(first, second, third || false); }
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
      var args = (filter === '@' ? parser : secondParser)(normalize$1(path), normalize$1(filter));
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
      filter = '/' + normalize$1(filter);
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

  class ConduitProductionRepository {
      constructor() {
          this._endpoint = null;
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
          this.endpoint = () => {
              if (this._endpoint == null) {
                  this._endpoint = Settings.shared().valueForKey("endpoint");
              }
              return this._endpoint;
          };
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
                  const response = yield fetch(this.endpoint() + "/" + path, init);
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

  class ArticlesViewController {
      constructor() {
          this.useCase = new ArticlesUseCase();
          // Lifecycle
          this.viewWillAppear = () => {
          };
          this.viewDidAppear = () => {
              this.headerView.setItems(this.useCase.menuItems());
              this.articleTabView.setItems(this.useCase.tabItems());
              this.useCase.requestArticles().then((container) => {
                  this.articlesTableView.setArticles(container.articles);
                  // setup pagenation
                  // this.pagenation_view.shownPage = useCase.currentPage()
                  // this.pagenation_view.setCountOfPage( useCase.pageCount() )
              });
          };
          this.viewWillDisappear = () => {
              console.log("viewWillAppear");
          };
          this.viewDidDisappear = () => {
              console.log("viewDidAppear");
          };
          // Public functions
          this.isLoggedIn = () => {
              return this.useCase.isLoggedIn();
          };
          // IB Actions
          this.didSelectTab = (item) => {
              console.log(item);
          };
          this.didSelectProfile = (profile) => {
              this.useCase.jumpToProfileScene(profile);
          };
          this.didSelectArticle = (article) => {
              this.useCase.jumpToArticleScene(article);
          };
          this.didFavoriteArticle = (article) => {
              this.useCase.toggleFavorite(article).then((articles) => {
                  if (articles === null) {
                      return;
                  }
                  this.articlesTableView.setArticles(articles);
              });
          };
      }
  }

  var HeaderView = {
    'css': `header_view .nav-link .user-pic,[is="header_view"] .nav-link .user-pic{ margin-right: 0px; }`,

    'exports': {
      setItems( items ){
          this.state.items = items;
          this.update();
      },

      navItemClassName( isActive ){
          return "nav-link" + ( isActive ? " active" : "" )
      }
    },

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template(
        '<nav class="navbar navbar-light"><div class="container"><a class="navbar-brand" href="/">conduit</a><ul class="nav navbar-nav pull-xs-right"><li expr0 class="nav-item"></li></ul></div></nav>',
        [{
          'type': bindingTypes.EACH,
          'getKey': null,
          'condition': null,

          'template': template(
            '<a expr1>\n                    &nbsp;\n                    <i expr2></i><img expr3 class="user-pic"/><!----></a>',
            [{
              'redundantAttribute': 'expr1',
              'selector': '[expr1]',

              'expressions': [{
                'type': expressionTypes.TEXT,
                'childNodeIndex': 3,

                'evaluate': function(scope) {
                  return ['\n                    ', scope.item.title, '\n                '].join('');
                }
              }, {
                'type': expressionTypes.ATTRIBUTE,
                'name': 'class',

                'evaluate': function(scope) {
                  return scope.navItemClassName(scope.item.isActive);
                }
              }, {
                'type': expressionTypes.ATTRIBUTE,
                'name': 'href',

                'evaluate': function(scope) {
                  return scope.item.href;
                }
              }]
            }, {
              'type': bindingTypes.IF,

              'evaluate': function(scope) {
                return scope.item.icon !== null;
              },

              'redundantAttribute': 'expr2',
              'selector': '[expr2]',

              'template': template(null, [{
                'expressions': [{
                  'type': expressionTypes.ATTRIBUTE,
                  'name': 'class',

                  'evaluate': function(scope) {
                    return scope.item.icon;
                  }
                }]
              }])
            }, {
              'type': bindingTypes.IF,

              'evaluate': function(scope) {
                return scope.item.image !== null;
              },

              'redundantAttribute': 'expr3',
              'selector': '[expr3]',

              'template': template(null, [{
                'expressions': [{
                  'type': expressionTypes.ATTRIBUTE,
                  'name': 'src',

                  'evaluate': function(scope) {
                    return scope.item.image;
                  }
                }]
              }])
            }]
          ),

          'redundantAttribute': 'expr0',
          'selector': '[expr0]',
          'itemName': 'item',
          'indexName': null,

          'evaluate': function(scope) {
            return scope.state.items;
          }
        }]
      );
    },

    'name': 'header_view'
  };

  var FooterView = {
    'css': null,
    'exports': null,

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template(
        '<footer><div class="container"><a href="/" class="logo-font">conduit</a><span class="attribution">\n        An interactive learning project from <a href="https://thinkster.io">Thinkster</a>. Code &amp; design licensed under MIT.\n        </span></div></footer>',
        []
      );
    },

    'name': 'footer_view'
  };

  var BannerView = {
    'css': `banner_view .spotlink,[is="banner_view"] .spotlink{ color: white; } banner_view .spotlink:hover,[is="banner_view"] .spotlink:hover{ color: white; text-decoration: none; }`,
    'exports': null,

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template(
        '<div class="banner"><div class="container"><h1 class="logo-font">conduit</h1><p>A place to share your <a class="spotlink" href="https://v3.riotjs.now.sh" target="blank">RIOT</a> knowledge.</p></div></div>',
        []
      );
    },

    'name': 'banner_view'
  };

  var ArticleTabView = {
    'css': null,

    'exports': {
      setItems( items ){
          this.state.items = items;
          this.update();
      },

      actionOfClickTab(event){
          props.didSelectTab( event.item.item );
      },

      navItemClassName( isActive ){
          return "nav-link" + ( isActive ? " active" : "" )
      }
    },

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template(
        '<div expr4><ul class="nav nav-pills outline-active"><li expr5 class="nav-item"></li></ul></div>',
        [{
          'redundantAttribute': 'expr4',
          'selector': '[expr4]',

          'expressions': [{
            'type': expressionTypes.ATTRIBUTE,
            'name': 'class',

            'evaluate': function(scope) {
              return scope.props.toggle_style;
            }
          }]
        }, {
          'type': bindingTypes.EACH,
          'getKey': null,
          'condition': null,

          'template': template('<a expr6><!----></a>', [{
            'redundantAttribute': 'expr6',
            'selector': '[expr6]',

            'expressions': [{
              'type': expressionTypes.TEXT,
              'childNodeIndex': 0,

              'evaluate': function(scope) {
                return scope.item.title;
              }
            }, {
              'type': expressionTypes.ATTRIBUTE,
              'name': 'class',

              'evaluate': function(scope) {
                return scope.navItemClassName( scope.item.isActive );
              }
            }, {
              'type': expressionTypes.EVENT,
              'name': 'onclick',

              'evaluate': function(scope) {
                return scope.actionOfClickTab;
              }
            }]
          }]),

          'redundantAttribute': 'expr5',
          'selector': '[expr5]',
          'itemName': 'item',
          'indexName': null,

          'evaluate': function(scope) {
            return scope.state.items;
          }
        }]
      );
    },

    'name': 'article_tab_view'
  };

  var ArticlesTableView = {
    'css': `articles_table_view .author-link,[is="articles_table_view"] .author-link{ color: #5cb85c; cursor : pointer; text-decoration: none; } articles_table_view .author-link:hover,[is="articles_table_view"] .author-link:hover{ color: #5cb85c; text-decoration: underline; }`,

    'exports': {
      setArticles( articles ){
          this.state.articles = articles;
          this.update();
      },

      actionOfClickProfile(event){
          this.props.didSelectProfile ( event.item.article.author );
      },

      actionOfClickArticle(event){
          this.props.didSelectArticle( event.item.article );
      },

      actionOfFavoriteButton(event){
          this.props.didFavoriteArticle( event.item.article );
      },

      favoriteButtonClassName( favorited ){
          return "btn btn-sm pull-xs-right" + ( favorited ? " btn-primary" : " btn-outline-primary" )
      }
    },

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template('<div expr7 class="article-preview"></div>', [{
        'type': bindingTypes.EACH,
        'getKey': null,
        'condition': null,

        'template': template(
          '<div class="article-meta"><a expr8><img expr9/></a><div class="info"><a expr10 class="author author-link"><!----></a><span class="date">January 20th</span></div><button expr11><i class="ion-heart"></i><!----></button></div><a expr12 class="preview-link"><h1 expr13><!----></h1><p expr14><!----></p><span>Read more...</span><ul class="tag-list"><li expr15 class="tag-default tag-pill tag-outline"></li></ul></a>',
          [{
            'redundantAttribute': 'expr8',
            'selector': '[expr8]',

            'expressions': [{
              'type': expressionTypes.EVENT,
              'name': 'onclick',

              'evaluate': function(scope) {
                return scope.actionOfClickProfile;
              }
            }]
          }, {
            'redundantAttribute': 'expr9',
            'selector': '[expr9]',

            'expressions': [{
              'type': expressionTypes.ATTRIBUTE,
              'name': 'src',

              'evaluate': function(scope) {
                return scope.article.author.image;
              }
            }]
          }, {
            'redundantAttribute': 'expr10',
            'selector': '[expr10]',

            'expressions': [{
              'type': expressionTypes.TEXT,
              'childNodeIndex': 0,

              'evaluate': function(scope) {
                return scope.article.author.username;
              }
            }, {
              'type': expressionTypes.EVENT,
              'name': 'onclick',

              'evaluate': function(scope) {
                return scope.actionOfClickProfile;
              }
            }]
          }, {
            'redundantAttribute': 'expr11',
            'selector': '[expr11]',

            'expressions': [{
              'type': expressionTypes.TEXT,
              'childNodeIndex': 1,

              'evaluate': function(scope) {
                return [' ', scope.article.favoritesCount, '\n        '].join('');
              }
            }, {
              'type': expressionTypes.EVENT,
              'name': 'onclick',

              'evaluate': function(scope) {
                return scope.actionOfFavoriteButton;
              }
            }, {
              'type': expressionTypes.ATTRIBUTE,
              'name': 'class',

              'evaluate': function(scope) {
                return scope.favoriteButtonClassName(scope.article.favorited);
              }
            }]
          }, {
            'redundantAttribute': 'expr12',
            'selector': '[expr12]',

            'expressions': [{
              'type': expressionTypes.EVENT,
              'name': 'onclick',

              'evaluate': function(scope) {
                return scope.actionOfClickArticle;
              }
            }]
          }, {
            'redundantAttribute': 'expr13',
            'selector': '[expr13]',

            'expressions': [{
              'type': expressionTypes.TEXT,
              'childNodeIndex': 0,

              'evaluate': function(scope) {
                return [scope.article.title, ' '].join('');
              }
            }]
          }, {
            'redundantAttribute': 'expr14',
            'selector': '[expr14]',

            'expressions': [{
              'type': expressionTypes.TEXT,
              'childNodeIndex': 0,

              'evaluate': function(scope) {
                return scope.article.description;
              }
            }]
          }, {
            'type': bindingTypes.EACH,
            'getKey': null,
            'condition': null,

            'template': template('<!---->', [{
              'expressions': [{
                'type': expressionTypes.TEXT,
                'childNodeIndex': 0,

                'evaluate': function(scope) {
                  return scope.tagWord;
                }
              }]
            }]),

            'redundantAttribute': 'expr15',
            'selector': '[expr15]',
            'itemName': 'tagWord',
            'indexName': null,

            'evaluate': function(scope) {
              return scope.article.tagList;
            }
          }]
        ),

        'redundantAttribute': 'expr7',
        'selector': '[expr7]',
        'itemName': 'article',
        'indexName': null,

        'evaluate': function(scope) {
          return scope.state.articles;
        }
      }]);
    },

    'name': 'articles_table_view'
  };

  // import ArticlesUseCase from "../../Domain/UseCase/ArticlesUseCase"

  var Articles = {
    'css': null,

    'exports': {
      onBeforeMount() {
          // set owner
          let vc = new ArticlesViewController();
          this.owner = vc;

          // linking outlet
          vc.view = this;

          // Call lifecycle
          vc.viewWillAppear();
      },

      onMounted(){
          // Mount components
          let headerEl = this.$("div#header_view");
          let headerView = component(HeaderView)( headerEl );
          let footerEl = this.$("div#footer_view");
          component(FooterView)( footerEl ); // unuse
          if ( this.owner.isLoggedIn() == false ){
              let bannerEl = this.$("div#banner_view");
              component(BannerView)( bannerEl ); // unuse
          }
          let articleTabEl = this.$("div#article_tab_View");
          let articleTabView = component(ArticleTabView)( articleTabEl, { toggle_style: "feed-toggle", didSelectTab: this.owner.didSelectTab });
          let articlesTableEl = this.$("div#articles_table_view");
          let articlesTableView = component(ArticlesTableView)( articlesTableEl, {
              didSelectProfile: this.owner.didSelectProfile,
              didSelectArticle: this.owner.didSelectArticle,
              didFavoriteArticle: this.owner.didFavoriteArticle
          });

          // linking outlet
          this.owner.headerView = headerView;
          this.owner.articleTabView = articleTabView;
          this.owner.articlesTableView = articlesTableView;

          // Call lifecycle
          this.owner.viewDidAppear();
      },

      onBeforeUnmount(){ this.owner.viewWillAppear(); },
      onUnmount(){ this.owner.viewDidAppear(); }
    },

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template(
        '<div class="home-page"><div id="header_view"></div><div id="banner_view"></div><div class="container page"><div class="row"><div class="col-md-9"><div id="article_tab_View"></div><div id="articles_table_view"></div></div><div class="col-md-3"></div></div></div><div id="footer_view"></div></div>',
        []
      );
    },

    'name': 'articles'
  };

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
                  viewControllerName: "articles"
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
                  viewControllerName: "articles"
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
                  // register view controllers
                  register("articles", Articles);
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
                  mount("div#mainView", null, "notfound_view_controller");
              });
              // Expected routing
              this.scenes.forEach(scene => {
                  route(scene.filter, () => {
                      mount("div#mainView", null, scene.viewControllerName);
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
                  vcname = "articles";
              }
              setTimeout(() => {
                  mount("div#mainView", null, vcname);
              }, 5);
          };
      }
  }

  // import ApplicationUseCase from "../Domain/UseCase/ApplicationUseCase"

  var application = {
    'css': null,

    'exports': {
      onBeforeMount( _, state) {
          state.useCase = new ApplicationUseCase();
      },

      onMounted( _, state){
          state.useCase.initialize( ( error ) => {
              if (error != null){
                  // go to 404
                  throw Error("Initialize is failed")
              }
              state.useCase.setRoute();
              state.useCase.routing();
          });
      }
    },

    'template': function(template, expressionTypes, bindingTypes, getComponent) {
      return template('<div id="mainView"></div>', []);
    },

    'name': 'application'
  };

  // Import Polyfill
  // Install plugin
  // install((component) => {
  //     const { onBeforeMount } = component
  //     component.onBeforeMount = (props, state) => {
  //         if (props["ref"]) {
  //             props["ref"](component)
  //         }
  //         onBeforeMount.apply(component, [props, state])
  //     }
  //     return component
  // })
  // Start Application
  component(application)(document.getElementById("application"));

}());
