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

        const copy = (o, ff) => {

            let r = {};
            ff.forEach(f => r[f] = o[f]);
            return r;
        };

        const log = (name, data, fields) => debugMode == 'all' || debugMode == name
            ? console.log(name, JSON.stringify(data.map(d => fields ? copy(d, fields) : d), null, C.TXT.TAB)) : null;

        return Object.freeze({
            isBlock: e => e.tagName === C.ZX.BLOCK,
            getBlocks: e => utils.toArray(e.getElementsByTagName(C.ZX.BLOCK)),
            getId: e => e.getAttribute(C.ATTR.ID),
            setDebugMode: m => debugMode = m,
            toArray,
            checks,
            log
        });
    })();

    //===========================================================
    //  II. Types, child types and their implementations
    //-----------------------------------------------------------
    const types = (() => {

        const data = []; //Тип контрола может состоять из компонентов ("полуинстансов" дочерних контролов)

        const getChildType = (block) => {

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

            return Object.seal({
                name: getTypeName(block),   //Имя типа дочернего контрола
                id: utils.getId(block),     //Идентификатор компонента (уникальный только внутри родителя)
                impl: getImpl(block)        //Имплементации расширений (спотов)
            });
        };

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

            const getChildren = (e) => {

                const ch = [];
                if (utils.isBlock(e))
                    ch.push(getChildType(e));

                utils.getBlocks(e).forEach(b => ch.push(getChildType(b)));

                return ch;
            };

            const addInner = (html, styles, onCreateFn, name = null) => {

                const type = Object.seal({
                    name,                           //Имя типа (null для главной страницы)
                    html,                           //HTML (копируется для каждого инстанса)
                    css: css2elem(styles, name),    //CSS (стили одни на все инстансы типа)
                    onCreateFn,                     //JS (создаётся объект для каждого инстанса)
                    display: 0,                     //Количество отображаемых контролов 
                    slots: getSlots(html),          //Места расширений
                    children: getChildren(html),    //Информация о компонентах (инстансах объявленных внутри типа)
                    dynCount: 0
                });

                data.push(type); //Добавим тип в массив типов
                return type;
            }

            return addInner;
        })();

        const get = (name) => data.find(t => t.name === name);

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

        const getChildName = (rootName, cId) => get(rootName).children.find(t => t.id === cId).name;

        const getcId = type => 'dyn' + type.dynCount++;

        const log = (...f) => utils.log('TYPES', data, f);

        return {
            add,
            get,
            getChildName,
            getcId,
            display,
            hide,
            log
        };
    })();

    //===========================================================
    //  III. Instance of types
    //-----------------------------------------------------------
    const inst = (() => {

        let count = 0;
        let cSchema = 'default';

        const data = [];

        const get = (id = null) => data.find(c => c.id === id);

        //////////////////////////////////////////////////////////////
        const dispType = contr => { //Рекурсивно отобразить все дочерние типы

            if (contr.visible) return;
            contr.visible = true;

            types.display(contr.type);
            getChildren(contr.id).forEach(c => dispType(c));
        };

        const dispControl = id => {

            const cont = get(id);

            console.log('display:', cont.type, cont.id);
            cont.rootEl.appendChild(cont.html);
            dispType(cont);

            if (cont.displayFn) cont.displayFn();
        };

        //////////////////////////////////////////////////////////////
        const hideType = contr => { //Рекурсивно скрыть все дочерние типы

            if (!contr.visible) return;
            contr.visible = false;

            types.hide(contr.type);
            getChildren(contr.id).forEach(c => hideType(c));
        };

        const hideControl = id => {

            const cont = get(id);

            if (!(cont.hideFn ? cont.hideFn() : false)) {

                console.log('hide:', cont.type, cont.id);
                cont.html.parentNode.removeChild(cont.html);
                hideType(cont);
                return true;
            };
        };

        //////////////////////////////////////////////////////////////
        const getChildren = (id, mode) => data.filter(d => mode ? d.sId === id : d.pId === id);

        const getChildControl = (id, cId = null, mode) => {

            const ch = getChildren(id, mode).find(c => c.cId === cId);

            //TODO: Сделать ленивую инициализацию
            if (!ch)
                throw new Error("Control with parent ID '" + id
                    + "' and component ID '" + cId + "' not found");

            return ch.zxBase;
        };

        const createId = cId => cId + '-' + count++;
        const setDisplayHandlerControl = (id, f) => get(id).displayFn = f;
        const setHideHandlerControl = (id, f) => get(id).hideFn = f;

        //Результат get(id) на момент инициализации не определён!
        const createBaseManager = (id) => {

            if (id !== null)
                utils.checks.oblig(id);

            return {
                onInit: () => { }, //Для определения в контролах
                display: () => dispControl(id),
                hide: () => hideControl(id),
                getId: () => id,
                getHTML: () => get(id).html,
                get: ch => getChildControl(id, ch, true),
                getAll: ch => getChildren(id).map(c => c.zxBase),
                setColor: (colorId, schema, value) => get(id).colors.push({ id: colorId, schema, value }),
                setText: (textId, textObj) => textBuilder.create(id, textId, textObj),
                refreshTexts: () => textBuilder.refresh(id),
                setDisplayHandler: f => setDisplayHandlerControl(id, f),
                setHideHandler: f => setHideHandlerControl(id, f),
                // setLangHandler: f => ..., <-- TODO!!!
                // setColorHandler: f => ..., <-- TODO!!!
                create: (rElem, fn, tName, cId) => builder.create(id, rElem, fn, tName, cId),
                copy: (sampleId, fn) => builder.copy(id, sampleId, fn),
            };
        };

        const createManager = (id, onCreateFn) => {

            const zxBase = createBaseManager(id);

            //Add custom functions
            if (onCreateFn)
                onCreateFn(zxBase);

            return Object.freeze(zxBase);
        };

        //////////////////////////////////////////////////////////////
        const renewParent = (id) => {

            const checkImpl = (impl, cId) => impl.find(i => !!i.components.find(c => c === cId));

            const cntr = get(id);
            const pControl = data.find(c => c.id === cntr.pId);
            const pType = types.get(pControl ? pControl.type : null);

            //В имплементациях компонентов родительского типа ищем компонент с ид. = ид. типа текущего контрола 
            const newType = pType ? pType.children.find(ch => checkImpl(ch.impl, cntr.cId)) : null;

            const newControl = newType
                ? data.filter(d => d.sId === cntr.pId).find(c => c.cId === newType.id) : null;

            if (newType && !newControl)
                throw new Error("Component '" + newType.id + "' in control '" + cntr.pId + "' not found");

            if (newControl)
                cntr.pId = newControl.id;
        };

        //////////////////////////////////////////////////////////////
        const initControl = (id, zxBase) => {

            if (!id) {
                types.log('name', 'children');
                utils.log('INST', data);
                //Будут ли имплементации при динамической инициализации?
                data.forEach(c => renewParent(c.id));
            }

            getChildren(id).forEach(c => initControl(c.id, c.zxBase)); //Load children
            zxBase.onInit(); //Переопределяется в конкретном контроле

            if (!id) //После всех вызовов onInit()
                textBuilder.setLang();  //Задавать из вне
        };

        //////////////////////////////////////////////////////////////
        const add = (rootEl, html, onCreateFn, tName = null, cId, id = null, pId) => {

            const zxBase = createManager(id, onCreateFn);

            const control = Object.seal({
                type: tName,
                id,
                cId, //Идентификатор компонента 
                sId: pId, //Source parent ID (изначальный родительский ид.)
                pId,
                rootEl,
                html,
                displayFn: null,
                hideFn: null,
                init: () => initControl(id, zxBase),
                zxBase,
                colors: [],
                texts: [],
                nodes: [],
                visible: false //Зависит от корневого элемента
            });

            data.push(control);
            return control;
        };

        //////////////////////////////////////////////////////////////
        const getTextData = id => {

            const c = get(id);

            return Object.freeze({
                html: c.html,
                nodes: c.nodes,
                texts: c.texts
            });
        };

        const getIds = () => data.map(c => c.id);

        //////////////////////////////////////////////////////////////
        return Object.freeze({
            createId,
            add,
            get,
            getTextData,
            getIds
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

        const fillText = (n, texts) => texts.forEach((t, i) => renewText(n, t, i));

        const getTexts = (texts, nTexts) => texts.filter(t => t.lang === lang && nTexts.find(nt => nt === t.id));

        const fill = id => {

            const c = inst.getTextData(id);
            c.nodes.forEach(n => fillText(n, getTexts(c.texts, n.texts)));
        };

        //////////////////////////////////////////////////////////////
        const setLangs = ll => {
            langs = ll;
        };

        const setLang = l => {

            //Return, if initial language is already set
            if (!l && lang)
                return;

            if (l && !langs.find(lang => lang === l))
                throw new Error('Language "' + l + '" is unknown');

            if (l)
                lang = l;

            inst.getIds().forEach(id => fill(id));
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

            const typeCounter = (() => {

                const data = []; //Имя типа + функция обработчик

                const add = (name, func) => {
                    const exist = data.find(t => t.name === name);
                    data.push({ name, func });
                    return exist;
                };

                return Object.freeze({
                    add,
                    get: name => data.filter(t => t.name === name).map(t => t.func)
                });
            })();

            const load = (name, func) => {

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
                    typeCounter.get(name).forEach(f => f(type));
                };

                const load = () => {

                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', path + C.ZX.PREFIX + '-' + name + '.html', true);
                    xhr.onreadystatechange = function () {

                        if (this.readyState !== 4) return;
                        if (this.status !== 200) return; //TODO: Add error handling
                        onInit(name, this.responseText);
                    };

                    xhr.send();
                };

                //Find type
                const type = types.get(name);

                if (type)
                    func(type); //If type found, call callback function immediately 
                else if (!typeCounter.add(name, func)) //If type is loading now, add handler to the list
                    load(); //If it's a new type, start loading 
            };

            return load;
        })();

        //-----------------------------------------------------------
        //  Создаём инстанс заданного контрола
        //-----------------------------------------------------------
        const createInstance = (() => {

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
            const createHTML = (tHTML, cId, pChildren, rElem, newId, stControl) => {

                const html = tHTML.cloneNode(true);

                //Добавляем impl в соответствующий slot
                if (stControl)
                    pChildren.find(c => c.id === cId).impl
                        .forEach(i => slotImpliment(i.id, html, rElem, newId));

                //Move class atrribute from "Z" tag to root element
                utils.toArray(rElem.classList).forEach(c => {
                    rElem.classList.remove(c);
                    html.classList.add(c);
                });

                rElem.appendChild(html); //Для построения HTML-дерева, все контролы изначально видны

                return html;
            };

            //////////////////////////////////////////////////////////////
            const createInner = (counter, cId, pType, pHTML, pId = null, tName) => {

                if (!cId && pType.children.length > 1)
                    throw new Error('Attribute `ID` for control doesn\'t set!');

                //Находим точку добавления контрола
                const rElem = utils.isBlock(pHTML) && (pHTML.id === cId || !cId)
                    ? pHTML : !cId
                        ? utils.getBlocks(pHTML)[0] //Ищем просто первый блок
                        : pHTML.querySelector(C.CSS.ID + cId);

                //Сгенерируем ид контрола и обвном значение атрибута ид в корневом элементе
                const newId = inst.createId(cId);
                rElem.setAttribute(C.ATTR.ID, newId);

                //Инстанс корневого контрола
                let rootContr;

                //////////////////////////////////////////////////////////////
                //Create instance of the control (right now or after load)
                const callBackFn = (type) => {

                    types.display(type.name); //Add CSS (for first control) by default

                    //Формируем HTML-разметку
                    const html = createHTML(type.html, cId, pType.children, rElem, newId, !tName);

                    //Создаём новый контрол и получаем его идентификатор
                    const newControl = inst.add(rElem, html, type.onCreateFn, type.name, cId, newId, pId);

                    //Сохраним корневой инстанс для случая его динамического создания
                    if (tName)
                        rootContr = newControl;

                    //Рекурсивно проинициализируем дочерние элементы типа
                    type.children.forEach(comp => createInner(counter, comp.id, type, html, newControl.id));

                    counter.incInit();

                    //End process! 
                    if (counter.isInitEnd()) {

                        if (!tName)
                            rootContr = inst.get(); //To get global root control

                        if (!tName)
                            console.time('onInitEnd');

                        rootContr.init(); //Load controls & call zxBase.load() function
                        counter.onInitEnd(rootContr.zxBase);

                        if (!tName)
                            console.timeEnd('onInitEnd');
                    }
                };

                //////////////////////////////////////////////////////////////
                counter.incFound();
                loadType(tName || types.getChildName(pType.name, cId), callBackFn);
            };

            return createInner;
        })();

        //////////////////////////////////////////////////////////////
        const getCounter = (fn) => {

            let found = 0,
                init = 0,
                onInitEndFn = fn;

            return Object.freeze({
                incFound: () => found++,
                incInit: () => init++,
                isInitEnd: () => found === init,
                onInitEnd: tr => onInitEndFn ? onInitEndFn(tr) : null
            });
        };

        //////////////////////////////////////////////////////////////
        const createBlock = (rElem, tName, cId) => {

            const block = document.createElement(C.ZX.BLOCK);
            block.setAttribute("type", tName);
            block.setAttribute(C.ATTR.ID, cId);
            rElem.appendChild(block);
        };

        //////////////////////////////////////////////////////////////
        const create = (rId, rElem, fn, tName, cId) => {

            const rContr = inst.get(rId);
            const rType = types.get(rContr ? rContr.type : null);

            //TODO: Сделать проверку на незанятые значения, т.к. контролы могут удаляться
            if (!cId)
                cId = types.getcId(rType);

            //TODO: Проверить уникальность localId в пределах родительского типа
            //else
            //  check(cId);

            //Create block element
            createBlock(rElem, tName, cId);

            createInstance(
                getCounter(fn),
                cId,
                rType,
                rContr.html,
                rContr ? rContr.id : null,
                tName);
        };

        const copy = (rId, sampleId, fn) => {

            const smp = inst.get(sampleId);
            create(rId, smp.rootEl.parentElement, fn, smp.type);
        };

        const massCopy = (sample, fn) => {
            //...
        };

        const free = () => {
            //TODO: Динамическое удаление контрола
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
            utils.setDebugMode(s.debug ? s.debug : 'none');
            textBuilder.setLangs(s.langs ? s.langs : ['en']);

            //Предварительно создадим тип, чтобы избежать попытки его загрузить
            const rType = types.add(document.body);

            inst.add(
                document.body.parentElement,
                document.body,
                zxBase => zxBase.onInit = () => s.init(zxBase));

            const cnt = getCounter();
            rType.children.forEach(comp => createInstance(cnt, comp.id, rType, rType.html));
        });

        let path;

        return Object.freeze({
            init,
            create,
            copy,
            massCopy,
            free
        });
    })();

    //===========================================================
    //  IV. Return
    //-----------------------------------------------------------
    return Object.freeze({
        init: builder.init,
        utils: Object.freeze({ toArray: utils.toArray }),
        setLang: textBuilder.setLang,
        getLangs: textBuilder.getLangs,
        getLang: textBuilder.getLang
    });
})();