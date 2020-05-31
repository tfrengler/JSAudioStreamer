"use strict";

export class ServiceLocator {
    
    constructor() {
        this._services = Object.create(null);

        return Object.freeze(this);
    }

    provide(name="NOT_DEFINED", service=null) {
        if (!service) return;
        this._services[name] = service;
    }

    get(name) {
        if (this._services[name])
            return this._services[name];

        return Symbol("NON_EXISTANT_SERVICE");
    }
}