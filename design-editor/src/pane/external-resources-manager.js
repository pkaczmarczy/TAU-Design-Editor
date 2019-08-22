'use babel'

/**
 * Module for design editor external resources management
 * Keeps loading resources and sends notification after all
 * additional resources has been loaded
 * @module design-editor-element
 */


import {eventEmitter, EVENTS} from '../events-emitter';

class ExternalResourcesManager {

    constructor(iframe) {
        console.log("p.kaczmarczy", "ExternalResourceManagerHasBeenCreated");
        this._loadingProgress = {};
        this._iframe = iframe;
    }

    loadExternalResources(name, resources) {
        console.log("Loading external resources");
        let contentDocument = this._iframe.contentDocument;
        let head = contentDocument.head;

        resources.forEach((lib) => {
            if (typeof lib === "string") {
                lib = {"src": lib};
            }
            let self = this;
            let element;
            let fileExtension = lib.src.match(/([^.]+)$/);
            if (fileExtension.length) {
                fileExtension = fileExtension[0];
                switch (fileExtension) {
                    case "js" :
                        if (head.querySelector("script[src='" + lib.src + "']")) {
                            // continue
                            return;
                        };
                        element = document.createElement("script");
                        element.setAttribute("type", "text/javascript");
                        element.setAttribute("src", lib.src);
                    break;
                    case "css" :
                        if (head.querySelector("link[href='" + lib.src + "']")) {
                            // continue
                            return;
                        };
                        element = document.createElement("link");
                        element.setAttribute("type", "text/css");
                        element.setAttribute("rel", "stylesheet");
                        element.setAttribute("href", lib.src);
                    break;
                }

                if (element) {
                    // async load
                    element.addEventListener("load", (function (name, event) {
                        // console.log();
                        self._loadingProgress[name].splice(self._loadingProgress[name].indexOf(event.target), 1);

                        if (self._loadingProgress[name].length == 0) {
                            eventEmitter.emit(EVENTS.ExternalResourcesLoaded, {name: name});
                            delete self._loadingProgress[name];
                        }
                    }).bind(null, name));

                    // add attributes
                    if (lib.attributes) {
                        Object.keys(lib.attributes).forEach(function (key) {
                            element.setAttribute(key, lib.attributes[key]);
                        });
                    }

                    if (this._loadingProgress.hasOwnProperty(name)) {
                        this._loadingProgress[name].push(element);
                    } else {
                        this._loadingProgress[name] = [element]
                    }

                    head.appendChild(element);
                }
            };
        });
    }

    onWidgetResourcesLoaded() {

    }
}

export {ExternalResourcesManager};