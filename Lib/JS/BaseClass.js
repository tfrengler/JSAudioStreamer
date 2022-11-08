"use strict";

// A base class that when used with Proxy() tries to closely emulate the behaviour of other languages:
// - Attempting to access properties that don't exist causes an error
// - Attempting to set properties that don't exist causes an error
// - Private variables and methods are achieved by prefixing their names with an underscore eg. _calculateWidth()

/**
 * A base class for other classes that when used with Proxy() tries to closely emulate the behaviour of static languages
 */
export const BaseClass = Object.create(null);

BaseClass.defineProperty = () => { throw new Error("Properties cannot be redefined on object"); }

BaseClass.deleteProperty = function(target, property)
{
    if (this.has(target, property))
        throw new Error("Object does not contain public property with name: " + property);

    target[property] = null;
    return true;
}

// BaseClass.getOwnPropertyDescriptor = function(target, prop) {
//     return {
//         enumerable: true,
//         configurable: false
//     };
// }

BaseClass.get = function(target, property, receiver)
{
    if (!this.has(target, property))
        throw new Error("Object does not contain public property with name: " + property);

    let ReturnData = Reflect.get(target, property, receiver);

    if (typeof(ReturnData) === typeof(Function))
        return ReturnData.bind(target);

    return ReturnData;
}

BaseClass.has = function(target, key)
{
    if (key[0] === '_') return false;
    return Reflect.has(target, key);
}

BaseClass.ownKeys = function(target)
{
    return Reflect.ownKeys(target).filter(property => property[0] !== "_");
}

BaseClass.set = function(target, property, value, receiver)
{
    if (!this.has(target, property))
        throw new Error("Object does not contain public property with name: " + key);

    return Reflect.set(target, property, value, receiver);
}

BaseClass.setPrototypeOf = () => { throw new Error("Illegal operation") };

Object.freeze(BaseClass);