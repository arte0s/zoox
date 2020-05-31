/*
MIT License

Copyright (c) 2020 Artem Shmidt
https://arte0s.github.io/zoox/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';
const zoox = (() => {

    const C = {
        ZX: Object.freeze({
            PARAM: 'zxBase',
            BLOCK: 'Z',
            PREFIX: 'z',
            SLOT: 'Z-SLOT',
            IMPL: 'z-impl'
        }),
        DEBUG: Object.freeze({
            NONE: 'none',
            ALL: 'all'
        }),
        TXT: Object.freeze({
            BREAK: '\n',
            TAB: '\t',
        }),
        TAG: Object.freeze({
            STYLE: 'STYLE',
            SCRIPT: 'SCRIPT',
            BODY: 'BODY',
        }),
        ATTR: Object.freeze({
            TYPE: 'TYPE',
            ID: 'ID'
        }),
        CSS: Object.freeze({
            ALL: '*',
            ID: '#',
            ANIM: '@'
        })
    };

    //===========================================================
    //  I. Utility functions
    //-----------------------------------------------------------
    const utils = (() => {

        let debugMode;

        const toArray = i => i ? Array.prototype.slice.call(i) : [];

        const checks = Object.freeze({
            oblig: (v) => {
                if (!v)
                    throw new Error('Variable is obligatory!');
            },
        });

        const getGuid = () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );

        const copy = (o, ff) => {

            let r = {};
            ff.forEach(f => r[f] = o[f]);
            return r;
        };

        const log = (name, data, fields) => debugMode == C.DEBUG.ALL || debugMode == name
            ? console.log(name, JSON.stringify(data.map(d => fields ? copy(d, fields) : d), null, C.TXT.TAB)) : null;

        return Object.freeze({
            isBlock: e => e.tagName === C.ZX.BLOCK, //Place to add control
            isLazy: e => e.getAttribute('z-lazy') !== null,
            getBlocks: e => utils.toArray(e.getElementsByTagName(C.ZX.BLOCK)),
            getId: e => e.getAttribute(C.ATTR.ID),
            setDebugMode: m => debugMode = m,
            toArray,
            getGuid,
            checks,
            log
        });
    })();

    //===========================================================
    //  II. Types, child types and their implementations
    //-----------------------------------------------------------
    const types = (() => {

        const data = []; //Тип контрола может состоять из компонентов ("полуинстансов" дочерних контролов)

        const addChild = (() => {

            const getTypeName = e => {

                const type = e.getAttribute('TYPE');

                if (!type)
                    throw new Error('For "t" tag you must set one "type" attribute!');

                return type;
            };

            //Отфильтруем имплементации (их м.б. несколько по кличеству слотов в контроле)
            const chImpl = bl => utils.toArray(bl.childNodes).filter(i => i.classList && i.classList.contains(C.ZX.IMPL));

            const createImpl = (id = null, components = []) => Object.freeze({ id, components });

            const getParent = e => {

                while (e && !utils.isBlock(e))
                    e = e.parentElement;

                return e;
            };

            //Проверим найденные имплементации на принадлежность родителю
            const checkImpl = (cBl, rBl) => getParent(cBl.parentElement) === getParent(rBl);

            //Если внутри имплентации есть блок, то занесём его в атрибут components
            const getComponents = e => utils.getBlocks(e).filter(cb => checkImpl(cb, e)).map(b => utils.getId(b));

            //Добавим информацию об компонентах дочерних контролов
            const getImpl = (bl) => {

                const im = chImpl(bl);

                return im.length > 0

                    //Если есть имплементации обработаем их, при этом если имплементация одна, то id необязателен
                    ? im.map(e => createImpl(e.getAttribute ? utils.getId(e) : null, getComponents(e)))

                    //Если имплементаций нет, то все дочерние элементы считаем имплементацией единственного слота
                    : bl.childNodes.length !== 0 ? [createImpl(null, getComponents(bl))] : [];
            };

            //We go up to the first Z-tag and return its id
            const getRealParentId = rElem => {

                const el = getParent(rElem.parentElement);
                return el ? el.id : null;
            };

            const create = (rElem) => Object.seal({
                name: getTypeName(rElem),       //Имя типа дочернего контрола
                id: utils.getId(rElem),         //Идентификатор компонента (уникальный только внутри родителя)
                pId: getRealParentId(rElem),    //Real parent component id
                impl: getImpl(rElem)            //Имплементации расширений (спотов)
            });

            return (chArr, rElem) => chArr.push(create(rElem));
        })();

        const add = (() => {

            const css2elem = (styles, name) => {

                if (!styles) return;

                const css = document.createElement(C.TAG.STYLE);
                css.setAttribute(C.ATTR.ID, name);

                //Во избежние пересечений добавим в каждое правило селектор с именем типа
                utils.toArray(styles.sheet.cssRules).forEach(r => {
                    css.innerHTML += r.cssText.substr(0, 1) === C.CSS.ANIM //Exclude keyframes (animation)
                        ? r.cssText + C.TXT.BREAK + C.TXT.BREAK
                        : C.TXT.BREAK + C.ZX.PREFIX + '[type="' + name + '"] ' + r.cssText + C.TXT.BREAK;
                });

                //CSS pretty print
                css.innerHTML = css.innerHTML.split('{').join('{' + C.TXT.BREAK + C.TXT.TAB);
                css.innerHTML = css.innerHTML.split(';').join(';' + C.TXT.BREAK + C.TXT.TAB);
                css.innerHTML = css.innerHTML.split(/[\t] }/).join('}');

                return css;
            };

            const getSlots = (e) => utils.toArray(e.getElementsByTagName(C.ZX.SLOT)).map(s => utils.getId(s));

            const getChildArray = (e) => {

                const ch = [];
                if (utils.isBlock(e))
                    addChild(ch, e);

                utils.getBlocks(e).forEach(b => addChild(ch, b));

                return ch;
            };

            return (html, styles, onCreateFn, name = null) => {

                const type = Object.seal({
                    name,                           //Имя типа (null для главной страницы)
                    html,                           //HTML (копируется для каждого инстанса)
                    css: css2elem(styles, name),    //CSS (стили одни на все инстансы типа)
                    onCreateFn,                     //JS (создаётся объект для каждого инстанса)
                    display: 0,                     //Количество отображаемых контролов 
                    slots: getSlots(html),          //Места расширений
                    children: getChildArray(html),    //Информация о компонентах (инстансах объявленных внутри типа)
                    dynCount: 0
                });

                data.push(type); //Добавим тип в массив типов
                return type;
            };
        })();

        const get = (name) => data.find(t => t.name === name);

        const getChildName = (rName, cId) => get(rName).children.find(t => t.id === cId).name;

        const getcId = type => 'dyn' + type.dynCount++;

        const log = () => console.log('TYPES:', data);

        const display = (name) => { //При отображении первого контрола с заданным типом добавляет его стили

            const type = get(name);
            if (++type.display === 1 && type.css)
                document.head.appendChild(type.css);
        };

        const hide = (name) => { //При скрытии последнего контрола с заданным типом удаляет его стили

            const type = get(name);
            if (--type.display === 0 && type.css)
                type.css.parentNode.removeChild(type.css);
        };

        return {
            add,
            get,
            getChildName,
            getcId,
            log,
            display,
            hide
        };
    })();

    //===========================================================
    //  III. Instance of types
    //-----------------------------------------------------------
    const inst = (() => {

        let count = 0;

        const data = [];

        const get = (id = null) => data.find(c => c.id === id);

        const getChildren = id => data.filter(d => d.pId === id); //Get children by parent id

        //Get children by source id (where the control was declared) 
        const getChildrenBySrc = id => data.filter(d => d.sId === id);

        const isRoot = id => !id; //Технический корневой контрол (BODY). Может быть только один!

        const createId = cId => cId + '-' + count++;

        const getTextData = id => {

            const c = get(id);

            return Object.freeze({
                html: c.html,
                nodes: c.nodes,
                texts: c.texts
            });
        };

        const log = () => {

            types.log();
            console.log('INST:', data);
        };

        //////////////////////////////////////////////////////////////
        //Результат get(id) на момент инициализации не определён!
        const createBase = (() => {

            const dispType = contr => { //Рекурсивно отобразить все дочерние типы

                if (contr.visible) return;
                contr.visible = true;

                types.display(contr.type.name);
                getChildren(contr.id).forEach(c => dispType(c));
            };

            const dispControl = id => {

                const cont = get(id);

                console.log('display:', cont.type.name, cont.id);
                cont.rootEl.appendChild(cont.html);
                dispType(cont);

                if (cont.displayFn) cont.displayFn();
            };

            //////////////////////////////////////////////////////////////
            const hideType = contr => { //Рекурсивно скрыть все дочерние типы

                if (!contr.visible) return;
                contr.visible = false;

                types.hide(contr.type.name);
                getChildren(contr.id).forEach(c => hideType(c));
            };

            const hideControl = id => {

                const cont = get(id);

                if (!(cont.hideFn ? cont.hideFn() : false)) {

                    // console.log('hide:', cont.type.name, cont.id);
                    cont.html.parentNode.removeChild(cont.html);
                    hideType(cont);
                    return true;
                };
            };

            const lazyInit = (id, cId = null, fn) => {

                log();

                let ch = getChildrenBySrc(id).find(c => c.cId === cId);

                if (!ch)
                    builder.createLazy(fn, cId, get(id));
                else if (fn)
                    fn(ch.zxBase);
            };

            const getChildControl = (id, cId = null) => {

                const ch = getChildrenBySrc(id).find(c => c.cId === cId);

                if (!ch)
                    throw new Error("Control with parent ID '" + id
                        + "' and component ID '" + cId + "' not found");

                return ch.zxBase;
            };

            const setDisplayHandlerControl = (id, fn) => get(id).displayFn = fn;
            const setInitHandler = (id, fn) => get(id).initFn = fn;
            const setHideHandlerControl = (id, fn) => get(id).hideFn = fn;

            const free = id => {

                getChildren(id).forEach(c => c.zxBase.free());

                const contr = get(id);

                if (!contr)
                    throw new Error('Control with id "' + id + '" not found!');

                if (contr.visible === true)
                    contr.zxBase.hide(); //Remove control from DOM

                const i = data.findIndex(c => c.id === id);

                if (i >= 0)
                    data.splice(i, 1);
            };

            //////////////////////////////////////////////////////////////
            return (id) => {

                if (id !== null) //To prevent undefined value
                    utils.checks.oblig(id);

                return {
                    display: () => dispControl(id),
                    hide: () => hideControl(id),
                    getId: () => id,
                    getHTML: () => get(id).html,
                    get: ch => getChildControl(id, ch),
                    getAll: ch => getChildren(id).map(c => c.zxBase),
                    setText: (textId, textObj) => textBuilder.create(id, textId, textObj),
                    refreshTexts: () => textBuilder.refresh(id),
                    lazyInit: (ch, fn) => lazyInit(id, ch, fn),
                    setInitHandler: fn => setInitHandler(id, fn),
                    setDisplayHandler: fn => setDisplayHandlerControl(id, fn),
                    setHideHandler: fn => setHideHandlerControl(id, fn),
                    create: (rElem, fn, tName, cId) => builder.create(id, rElem, fn, tName, cId),
                    copy: (sampleId, fn, pos) => builder.copy(id, sampleId, fn, pos),
                    free: () => free(id)
                };
            }
        })();

        //////////////////////////////////////////////////////////////
        const init = (() => {

            const getParent = (id, pId, cId) => {

                //Root control doesn't have parent
                if (isRoot(id))
                    return pId;

                const chArr = get(pId).type.children;

                const child = chArr ? chArr.find(c => c.id === cId) : null;

                const pCompId = child ? child.pId : null;

                const pControl = pCompId ? getChildrenBySrc(pId).find(c => c.cId === pCompId) : null;

                return pControl ? pControl.id : pId;
            };

            const renewParent = (control, id) => {

                control.pId = getParent(control.id, control.sId, control.cId);

                getChildrenBySrc(id).forEach(c => renewParent(c, c.id));
            };

            const innerInit = (control) => {

                getChildren(control.id).forEach(c => innerInit(c)); //Load children

                if (control.initFn)
                    control.initFn();  //Переопределяется в конкретном контроле
            };

            return (id, fn) => {

                const control = get(id);
                renewParent(control, id);
                innerInit(control, fn);

                //После всех вызовов onInit()
                textBuilder.setLang(null, id); //Задавать из вне

                if (fn)
                    fn(control.zxBase);
            };
        })();

        //////////////////////////////////////////////////////////////
        const add = (type, html, rootEl, cId, pId, id = null) => {

            const c = Object.seal({
                type: type,
                id,
                cId,        //Идентификатор компонента 
                sId: pId,   //Source parent ID (изначальный родительский ид.)
                pId: null,
                rootEl,
                html,
                initFn: null,
                displayFn: null,
                hideFn: null,
                init: () => innerInit(id),
                zxBase: createBase(id),
                texts: [],
                nodes: [],
                visible: pId || pId === null ? get(pId).visible : true, //Зависит от корневого элемента
            });

            data.push(c);
            // console.log('[ADD] data.length:', data.length);

            if (type.onCreateFn) //Add custom functions
                type.onCreateFn(c.zxBase);

            c.zxBase = Object.freeze(c.zxBase);

            return c;
        };

        //////////////////////////////////////////////////////////////
        return Object.freeze({
            isRoot,
            createId,
            add,
            get,
            getChildren: id => getChildren(id),
            getByComp: (pId, cId) => getChildrenBySrc(pId).find(c => c.cId === cId),
            getTextData,
            init,
            log,
        });
    })();

    //===========================================================
    //  IV. Texts builder
    //-----------------------------------------------------------
    const textBuilder = (() => {

        let langs;
        let lang;

        //////////////////////////////////////////////////////////////
        //  Find text elements
        const getTemplate = t => '{{' + t + '}}';

        const getTextElem = (c, tId) => utils.toArray(c.childNodes).filter(
            n => n.nodeType === Node.TEXT_NODE && n.textContent.search(getTemplate(tId)) !== -1);

        const getTextElements = (html, tId) => {

            const res = utils.toArray(html.getElementsByTagName(C.CSS.ALL));
            res.push(html);
            return res.reduce((r, c) => r.concat(getTextElem(c, tId)), []);
        };

        //////////////////////////////////////////////////////////////
        //  Create & renew nodes
        const createNode = (nodes, textId, e) => {

            const node = nodes.find(n => n.el === e);
            if (!node)
                nodes.push(Object.freeze({ el: e, text: e.nodeValue, texts: [textId] }));
            else if (!node.texts.find(nt => nt === textId))
                node.texts.push(textId);
        };

        const createNodes = (c, textId) => getTextElements(c.html, textId).forEach(e => createNode(c.nodes, textId, e));

        const renewNodes = id => {

            const c = inst.getTextData(id);
            c.nodes.length = 0;

            //Just process any one language
            c.texts.filter(t => t.lang === langs[0]).forEach(t => createNodes(c, t.id));
        };

        const refresh = id => {

            renewNodes(id);
            fill(id);
        };

        //////////////////////////////////////////////////////////////
        //  Create & fill texts
        const createInner = (id, textId, lang, value) => {

            if (!value)
                throw new Error('Text no found! id: "' + id
                    + '" textId: "' + textId
                    + '" lang: "' + lang + '"');

            const c = inst.getTextData(id);
            c.texts.push(Object.freeze({ id: textId, lang, value }));

            //Сохраним ссылки на нужные текстовые элементы и их начальные значения
            createNodes(c, textId);
        };

        const create = (id, textId, textObj) => langs.forEach(l => createInner(id, textId, l, textObj[l]));

        const renewText = (n, t, i) => {

            const templ = getTemplate(t.id);

            let text = i === 0 ? n.text : n.el.nodeValue;
            let pos;

            if (t.value === templ)
                throw new Error('Template value "' + t.value
                    + '" and tamplate "' + templ + '"can\'t be the same!');

            //Найдём позицию шаблона в тексте и обновим шаблон или текстовый элемент
            while (true) {

                pos = text.search(templ);

                if (pos >= 0)
                    text = text.substr(0, pos) + t.value + text.substr(pos + templ.length);
                else
                    break;
            }

            n.el.nodeValue = text;
        };

        const fillText = (cTexts, n) => {

            const texts = getTexts(cTexts, n.texts);
            texts.forEach((t, i) => renewText(n, t, i));
        };

        const getTexts = (texts, nTexts) => {

            return texts.filter(t => t.lang === lang && nTexts.find(nt => nt === t.id));
        };

        const fill = id => {

            //Рекурсивно обойдём всех потомков
            inst.getChildren(id).forEach(c => fill(c.id));

            const c = inst.getTextData(id);
            c.nodes.forEach(n => fillText(c.texts, n));
        };

        //////////////////////////////////////////////////////////////
        const setLangs = ll => {
            langs = ll;
        };

        const setLang = (l, id) => {

            if (l && !langs.find(lang => lang === l))
                throw new Error('Language "' + l + '" is unknown');

            lang = l || langs[0];

            if (!lang)
                throw new Error('Language is undefined!');

            fill(id);
        };

        return {
            create,
            refresh,
            setLangs,
            setLang,
            getLangs: () => langs.slice(),
            getLang: () => lang
        };
    })();

    //===========================================================
    //  V. Загружаем типы и строим дерево контролов
    //-----------------------------------------------------------
    const builder = (() => {

        //-----------------------------------------------------------
        //  Загружаем типы
        //-----------------------------------------------------------
        const loadType = (() => {

            const handlers = []; //Type name, handler

            const getHandler = name => handlers.filter(t => t.name === name).map(t => t.func);

            const onInit = (name, responseHTML) => {

                const doc = (new DOMParser()).parseFromString(responseHTML, "text/html");

                const css = doc.querySelector(C.TAG.STYLE);
                const script = doc.querySelector(C.TAG.SCRIPT);
                const html = doc.querySelector(C.TAG.BODY).children[0];

                //Add comment with type name to code & create new function
                const fn = (() => script
                    ? new Function(C.ZX.PARAM, C.TXT.TAB + C.TXT.TAB + '//' + name + C.TXT.BREAK
                        + C.TXT.TAB + C.TXT.TAB + '"use strict";' + C.TXT.BREAK
                        + script.innerText) : null)();

                const type = types.add(html, css, fn, name);
                getHandler(name).forEach(f => f(type));
            };

            const load = name => {

                const xhr = new XMLHttpRequest();
                xhr.open('GET', path + C.ZX.PREFIX + '-' + name + '.html', true);
                xhr.onreadystatechange = function () {

                    if (this.readyState !== 4) return;
                    if (this.status !== 200) return; //TODO: Add error handling
                    onInit(name, this.responseText);
                };

                xhr.send();
            };

            return (name, func) => {

                const exist = handlers.find(t => t.name === name);

                handlers.push({ name, func });

                if (!exist) //If new type start loading it
                    load(name);
            };
        })();

        //-----------------------------------------------------------
        //  Создаём инстанс заданного контрола
        //-----------------------------------------------------------        
        const createInst = (() => {

            const slotImplInner = (slot, content, id) => {

                if (content instanceof HTMLElement)
                    content.setAttribute(C.ATTR.ID, id);

                slot.parentElement.insertBefore(content, slot);

                utils.toArray(slot.classList)
                    .filter(c => content.classList) //Filter element without classList (text nodes)
                    .forEach(c => content.classList.add(c)); //Copy classes from slot to implementations
            };

            const slotImpliment = (implId, html, rElem, controlId) => {

                //Found slot
                const slot = !implId
                    ? html.querySelector(C.ZX.SLOT)
                    : html.querySelector(C.CSS.ID + implId);

                const id = controlId + '-' + implId;

                //Found implementation
                const implContent = rElem.querySelector(C.CSS.ID + implId)
                    || utils.toArray(rElem.childNodes); //If slot only one, id is optional

                //Add implamentation to slot
                implContent instanceof Array
                    ? implContent.forEach((n, i) => slotImplInner(slot, n, id + '-el' + i))
                    : slotImplInner(slot, implContent, id);

                //Remove default implementation
                slot.parentElement.removeChild(slot);
            };

            //////////////////////////////////////////////////////////////
            const createHTML = (tHTML, comp, newId, dynamic) => {

                const html = tHTML.cloneNode(true);

                //Добавляем impl в соответствующий slot
                if (!dynamic) //!!!Для динамиеского контрола в типе никакой информации нет!!!
                    comp.pContr.type.children.find(c => c.id === comp.cId)
                        .impl.forEach(i => slotImpliment(i.id, html, comp.rElem, newId));

                //Move class atrribute from "Z" tag to root element
                utils.toArray(comp.rElem.classList).forEach(c => {
                    comp.rElem.classList.remove(c);
                    html.classList.add(c);
                });

                comp.rElem.appendChild(html); //Для построения HTML-дерева, все контролы изначально видны

                return html;
            };

            //////////////////////////////////////////////////////////////
            const onInitEnd = (counter) => {

                const rContr = counter.getParent();
                const root = inst.isRoot(rContr.id);

                //Чтобы сократить лог, оставляем корень или отложенную инициализацию (без динамики)
                const noDyn = root || counter.isLazyLoad();

                if (noDyn) {
                    inst.log();
                    console.time('onInitEnd');
                }

                inst.init(rContr.id, counter.onEnd);

                //Hide loader
                if (loader)
                    loader.style.display = 'none';

                if (!root) //Если обычный контрол, то отобразим его самого
                    rContr.rootEl.style.display = '';
                else //Eсли контрол BODY, то отобразим его дочерние контролы
                    inst.getChildren(rContr.id).forEach(c => c.rootEl.style.display = '');

                if (noDyn)
                    console.timeEnd('onInitEnd');
            };

            //////////////////////////////////////////////////////////////
            const createEnd = (type, counter, comp, dynamic) => {

                const newId = inst.createId(comp.cId);

                //Renew attribut value in root control
                comp.rElem.setAttribute(C.ATTR.ID, newId);

                //Add CSS (for first control) by default
                types.display(type.name);

                //Create HTML-markup
                const html = createHTML(type.html, comp, newId, dynamic);

                //Create new instanse and get his id
                const newControl = inst.add(type, html, comp.rElem, comp.cId, comp.pContr.id, newId);

                //Тут нужен не текущий родитель (comp.pContr), а первоначальный (rContr) 
                //с которым вызывался первый createNew
                if (!createNew(counter, newControl))
                    onInitEnd(counter);
            };

            //////////////////////////////////////////////////////////////
            const getCounter = (rContr, cId, fn, lazyLoad) => {

                let comp = [];

                return Object.freeze({
                    addAll: cc => cc.forEach(c => comp.push(c)),
                    pop: () => comp.pop(),
                    isLazyLoad: () => lazyLoad,
                    getRoot: () => rContr,
                    getComp: () => cId,
                    getParent: () => cId ? inst.getByComp(rContr.id, cId) : rContr,
                    onEnd: zxBase => { if (fn) fn(zxBase) }
                });
            };

            //////////////////////////////////////////////////////////////
            const getRootElement = (rHTML, cId) => {

                const rElem = utils.isBlock(rHTML) && (rHTML.id === cId || !cId)
                    ? rHTML : !cId
                        ? utils.getBlocks(rHTML)[0] //Just find first z-tag
                        : rHTML.querySelector(C.CSS.ID + cId);

                if (!rElem)
                    throw new Error('Root element for control addition not found! cId: ' + cId);

                return rElem;
            };

            /////////////////////////////////////////////////////////////
            const isLazy = id => {

                while (id) {

                    let contr = inst.get(id);
                    if (utils.isLazy(contr.rootEl))
                        return true;

                    id = contr.pId;
                }
            };

            //////////////////////////////////////////////////////////////
            const addCh = (cId, pContr, children, counter) => {

                //Проверим что создаваемый инстанс ещё не создан
                if (inst.getByComp(pContr.id, cId))
                    throw new Error('Control is already created! pId: ', pContr.id + ', cId: ' + cId);

                const rElem = getRootElement(pContr.html, cId);

                if (!rElem)
                    throw new Error('Root HTML-element undefined! pId: ', pContr.id + ', cId: ' + cId);

                const lazyLoad = counter.isLazyLoad();

                const rootContr = counter.getParent();
                const rootLazy = rootContr ? isLazy(rootContr.id) : false; //Root control lazy?

                const lazy = utils.isLazy(rElem); //Is current control lazy?

                //При обычной инициалиазции скрываем содержимое ленивых компонентов
                if (!lazyLoad && lazy)
                    rElem.style.display = 'none';

                if ((lazyLoad && (
                    (rootLazy && !lazy) //Загружаем ТОЛЬКО НЕ ЛЕНИВЫЕ дочерние компоненты
                    || counter.getComp() === cId) //Или дочерний компонент указанный явно (первый при загрузке)
                ) || (!lazyLoad && !rootLazy && !lazy))
                    children.push(Object.freeze({ pContr, rElem, cId }));
            };

            //////////////////////////////////////////////////////////////
            const createNew = (counter, pContr, cId, tName) => {

                const ch = cId ? [cId] : pContr.type.children.map(c => c.id);

                const children = [];
                ch.forEach(id => addCh(id, pContr, children, counter));
                counter.addAll(children);

                const comp = counter.pop();

                if (comp) {

                    const endFn = type => createEnd(type, counter, comp, !!tName);

                    const name = tName || types.getChildName(comp.pContr.type.name, comp.cId);

                    const type = types.get(name);

                    if (type)
                        endFn(type); //Call callback function immediately 
                    else
                        loadType(name, endFn); //Add handler to the list & start loading for first handler
                }

                return !!comp;
            };

            //////////////////////////////////////////////////////////////
            return (pContr, fn, cId, tName, lazyLoad) => {

                //Display loader
                if (loader)
                    loader.style.display = '';

                createNew(getCounter(pContr, cId, fn, lazyLoad), pContr, cId, tName);
            };
        })();

        //-----------------------------------------------------------
        //  Остальные функции Builder-а
        //----------------------------------------------------------- 
        const createRootElement = (rElem, tName, cId, pos) => {

            const newElem = document.createElement(C.ZX.BLOCK);
            newElem.setAttribute("type", tName);
            newElem.setAttribute(C.ATTR.ID, cId);

            if (pos || pos === 0)
                rElem.insertBefore(newElem, rElem.children[pos]);
            else
                rElem.appendChild(newElem);
        };

        //////////////////////////////////////////////////////////////
        const create = (rId, rElem, fn, tName, cId, pos) => {

            const rContr = inst.get(rId);

            //TODO: Сделать проверку на незанятые значения, т.к. контролы могут удаляться
            if (!cId)
                cId = types.getcId(rContr.type);

            //TODO: Проверить уникальность localId в пределах родительского типа

            createRootElement(rElem, tName, cId, pos);

            createInst(rContr, fn, cId, tName);
        };

        const createLazy = (fn, cId, rContr) => {

            createInst(rContr, fn, cId, null, true);
        };

        const copy = (rId, sampleId, fn, pos) => {

            const smp = inst.get(sampleId);
            create(rId, smp.rootEl.parentElement, fn, smp.type.name, null, pos);
        };

        const getPath = p => {

            let path;
            path = p || '';
            const ch = path.slice(-1);
            path += (ch !== '/' && ch !== '\\') ? '/' : '';
            return path;
        };

        //////////////////////////////////////////////////////////////
        const init = s => window.addEventListener('load', () => {

            path = getPath(s.path);
            utils.setDebugMode(s.debug ? s.debug : C.DEBUG.NONE);
            textBuilder.setLangs(s.langs ? s.langs : ['en']);
            loader = s.loader ? s.loader() : null;

            //Create type right now to prevent try of load it
            const rType = types.add(document.body, null, zxBase => zxBase.setInitHandler(() => s.init(zxBase)));

            const rContr = inst.add(rType, document.body, document.body.parentElement);

            createInst(rContr);
        });

        //////////////////////////////////////////////////////////////
        let path, loader;

        return Object.freeze({
            init,
            create,
            createLazy,
            copy
        });
    })();

    //===========================================================
    //  IV. Return
    //-----------------------------------------------------------
    return Object.freeze({
        DEBUG: C.DEBUG,
        init: builder.init,
        utils: Object.freeze({
            toArray: utils.toArray,
            getGuid: utils.getGuid,
        }),
        lang: Object.freeze({
            set: textBuilder.setLang,
            getAll: textBuilder.getLangs,
            get: textBuilder.getLang
        })
    });
})();