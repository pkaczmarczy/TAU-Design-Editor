'use babel';

import Mustache from 'mustache';
import {EVENTS, eventEmitter} from '../../../../design-editor/src/events-emitter';

/**
 * Templates of generated code. 
 * String for single-line snippets
 * Array of strings otherwise
 */
const Sentences = {
    variable: 'var {{varName}} = ',
    querySelector: 'document.getElementById(\'{{id}}\')',
    listener: `{{instance}}.addEventListener(\'{{type}}\', function(event) {
        {{{content}}}{{^content}}{{/content}}
        //::write down yourown handler in here::
        })`,

    pageTransition: 'tau.changePage(\'{{url}}\', {transition: \'{{transition}}\'});',
    popupOpen: 'tau.openPopup(\'\');',
    tauWidget: 'var {{varName}} = {{constructorName}}({{targetElement}});',
    tauWidgetWithOptions: `var {{varName}} = {{constructorName}}({{targetElement}}, {
        {{options}}
        });`
    
};

/**
 *  Generates pieces of code which user can choose into Assistant-Wizard
 */
class AssistantCodeGenerator {
    /**
     * Constructor
     */
    constructor(lineEnding = '\n') {
        /**
         * This map is necessery to get information about previously used items
         */
        this._elementInstancePair = new WeakMap();
        this._lineEnding = lineEnding;
    }

    /**
     * Generate sentence
     * @param {string} sentenceBody
     * @returns {string}
     * @private
     */
    _generateCompleteSentence(sentenceBody) {
        return`${sentenceBody};${this._lineEnding}`;
    }

    /**
     * Generate random id of element with given keyword and timestamp
     * id template:  keyword-timestamp
     * example: closet-component-1554977903781
     * @param {string} [keyword=closet-component] given keyword
     * @returns {string}
     * @private
     */
    _generateId(keyword = 'closet-component') {
        return `${keyword}-${new Date().getTime()}`;
    }

    /**
     * Add attribute id to given element if this one doesn't exists
     * otherwise return id of given element
     * @param  {jQueryObject} $element - given element
     * @param  {Object} model 
     * @returns {string} created or existed id attribute of element
     * @private
     */
    _addIDIfnotExists(element, model) {
        let elementId = element.attr('id');

        if (!elementId) {
            elementId = this._generateId();
            element.attr('id', elementId);
            model.updateAttribute(element.attr('data-id'), 'id', elementId);
            eventEmitter.emit(EVENTS.ReplaceCodeView);
        }
        model.updateAttribute(element.attr('data-id'), 'id', elementId);

        return elementId;
    }

    /**
     * Generate JS code responsible for selector
     * template: document.getElementById('{{id}}')
     * @param {HTMLElement} element
     * @returns {string} 
     * @private
     */
    _generateQuerySelector(element, model) {
        return (Mustache.render(Sentences.querySelector, {
            id: this._addIDIfnotExists(element, model)
        }));
    }

    /**
     * Generate JS code for querySelector assigned to variable
     * template: var {{varName}} = document.getElementById('{{id}}');
     * @param {string} varName
     * @param {HTMLElement} element
     * @returns {*}
     * @private
     */
    _generateInstanceVariable(varName, element, model) {
        const selector = this._generateQuerySelector(element, model),
            option = {
                varName
            };

        return `${Mustache.render(Sentences.variable, option)}${selector}`;
    }

    /**
     * Generate code for TAU Widget
     * template: var {{varName}} = {{constructorName}}({{targetElement}});
     * @param {Object} options options object
     * @returns {string|Array} Code for TAU Widget
     * @private
     */
    _generateTAUWidgetVariable(options) {
        const code = ((options.options && Object.keys(options.options).length) 
            ? Mustache.render(Sentences.tauWidgetWithOptions, options)
            : (Mustache.render(Sentences.tauWidget, options)));
        return code.replace(/&#39;/g, '\'');
    }

    /**
     * Generate widget options as a multiline string
     * @param {Array} options array of options
     * @returns {string}
     * @private
     */
    _generateWidgetOptionSentence(options) {
        return options.reduce(
            (previous, current) => previous + `\t${current[0]}: ${(current[1])}${this._lineEnding}`, 
            ''
        );
    }

    /**
     * This method make an instance for used to info and element.
     * info has properties, name.
     * @param {HTMLElement} element selected element in Design Editor
     * @param {Object} info information object from wizard
     * @param {Object} model current document model
     * @returns {string|Array}
     */
    getInstance(element, info = {}, model) {
        const existedInstance = this._getValueFromMap(this._elementInstancePair, element);
        let result;

        if (!(existedInstance.length && info.useExist)) {
            if (info.name) {
                result = this._generateInstanceVariable(info.name, element, model);
                this._setValueToMap(this._elementInstancePair, element, info.name);
            } else {
                result = this._generateQuerySelector(element, model);
            }
        } else if (existedInstance.indexOf(info.name) >= 0) {
            result = info.name;
        }
        return this._generateCompleteSentence(result);
    }

    /**
     * Get code for TAU widget
     * @param {HTMLElement} element 
     * @param {Object} info information from wizard to code template
     * @returns {string|Array} JS code for TAU widget
     */
    getTAUWidget(element, info, model) {
        const existedInstance = this._getValueFromMap(this._elementInstancePair, element),
            result = {};

        
        if (!(existedInstance.length && info.useExist)) {
            result.targetElement = this._generateQuerySelector(element, model);
        } else if (existedInstance.indexOf(info.name) >= 0) {
            result.targetElement = info.name;
        }

        result.constructorName = info.widgetInfo.constructorName;
        result.varName = info.widgetInfo.name;
        result.options = this._generateWidgetOptionSentence(info.widgetInfo.options);

        return this._generateTAUWidgetVariable(result);
    }

    /**
     * This method make code for event listener 
     * @param {HTMLElement} element Selected element from Design Editor
     * @param {Object} info Information object from wizard
     * @returns {Array} Code for event Listener
     */
    getEventListener(element, info, model) {
        const instanceList = this._getValueFromMap(this._elementInstancePair, element);
        let instance,
            listener;

        if (info.useExist) {
            if (instanceList.indexOf(info.name) >= 0) {
                instance = info.name;
            }
        } else {
            instance = this._generateQuerySelector(element, model);
        }
        
        listener = Mustache.render(Sentences.listener, info);
        return this._generateCompleteSentence(instance + listener);
    }

    /**
     * Get page transition
     * @param {HTMLElement} element
     * @param {Object} info
     * @returns {*}
     */
    getPageTransition(element, info, model) {
        info.content = Mustache.render(Sentences.pageTransition, info);
        return this.getEventListener(element, info, model);
    }

    /**
     * Get open popup
     * @param {HTMLElement} element
     * @param {Object} info
     * @returns {*}
     */
    getPopupOpen(element, info, model) {
        info.content = Mustache.render(Sentences.popupOpen);
        return this.getEventListener(element, info, model);
    }

    /**
     * get instance list
     * @param {HTMLElement} element
     * @returns {*}
     */
    getInstanceListFromMap(element) {
        return this._getValueFromMap(this._elementInstancePair, element);
    }

    /**
     * Set value to map
     * @param {Map} map
     * @param {string} key
     * @param {*} value
     * @private
     */
    _setValueToMap(map, key, value) {
        const stored = this._getValueFromMap(map, key);

        stored.push(value);
        map.set(key, stored);
    }

    /**
     * Get value form map
     * @param {Map} map
     * @param {string} key
     * @returns {*}
     * @private
     */
    _getValueFromMap(map, key) {
        return map.get(key) || [];
    }
}

export {AssistantCodeGenerator};
