export class ServiceLocator {
    
    constructor() {
        this._services = Object.create(null);

        return Object.seal(this);
    }

    provide(name="NOT_DEFINED", service=null) {
        if (!service) return;
        this._services[name] = service;
    }

    get(name) {
        if (this._services[name])
            return this._services[name];

        return Symbol("NON_EXISTENT_SERVICE");
    }

    lock() {
        if (!this.__proto__.provide) return;

        this.__proto__.provide = null;
        Object.freeze(this._services);
        Object.freeze(this);
    }
}