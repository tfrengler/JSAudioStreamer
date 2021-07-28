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
BaseClass.deleteProperty = () => { throw new Error("Properties cannot be deleted on object"); }

BaseClass.get = function(target, property, receiver)
{
    if (!target[property] || property[0] === "_")
        throw new Error("No such property in object: " + property);

    if (typeof(target[property]) === typeof(Function))
        return target[property].bind(target);

    return Reflect.get(target, property, receiver);
}

BaseClass.has = function(target, key)
{
    if (key[0] === '_') return false;
    return key in target;
}

BaseClass.ownKeys = function(target)
{
    return Reflect.ownKeys(target).filter(property => property[0] !== "_");
}

BaseClass.set = function(target, property, receiver)
{
    if (!target[property] || property[0] === "_")
        throw new Error("No such property in object: " + property);

    return Reflect.set(target, property, receiver);
}

BaseClass.setPrototypeOf = () => { throw new Error("Illegal operation") };

Object.freeze(BaseClass);