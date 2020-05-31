"use strict";

// PUBLIC
const EventTypes = Object.freeze({
	"XXX": Symbol("XXX")
});

// PRIVATE
class Event {

	constructor(type, data) {

		this.type = type || Symbol("ARGUMENT_UNDEFINED");
		this.timeStamp = performance.now();
		this.data = (typeof data === typeof {} ? Object.freeze(data) : null);

		return Object.freeze(this);
	}
}

// PRIVATE
class Subscriber {

	constructor(callback, context) {

		this.callback = (typeof callback === typeof Function ? callback : null);
		this.id = parseInt(Date.now() - Math.random() * 100);
		this.context = context || null;
		this.timeStamp = performance.now();

		return Object.freeze(this);
	}
}

// PUBLIC
class EventManager {

	constructor() {
		this.subscribers = Object.create(null);

		for (let eventType in EventTypes)
			this.subscribers[ EventTypes[eventType] ] = [];

		console.log(`EventManager initialized. Events parsed: ${Object.keys(EventTypes).length}`);
		return Object.freeze(this);
	}

	_isValidEvent(eventType) {
		if (typeof eventType !== Symbol.name && !this.subscribers[eventType]) {
			console.error(`No such event type exists or it's not a valid symbol: ${eventType}`);
			return false;
		}

		return true;
	}

	_dispatch(event) {
		if (!this.subscribers[event.type].length) return;

		this.subscribers[event.type].forEach((subscriber)=> {
			if (typeof subscriber.callback === typeof Function)
				subscriber.callback.apply(subscriber.context || null, [event.data]);
		});
	}

	subscribe(eventType, callback, context=null) {
		if (!this._isValidEvent(eventType || Symbol("ARGUMENT_UNDEFINED"))) return;

		let newSubscriber = new Subscriber(callback, context);
		this.subscribers[eventType].push(newSubscriber);

		return newSubscriber.id;
	}

	unsubscribe(eventType, subscriberID) {
		if (!this._isValidEvent(eventType || Symbol("ARGUMENT_UNDEFINED"))) return false;

		return this.subscribers[eventType].some((subscriber, index, subscriberArray)=> {
			if (subscriber.id === subscriberID) {
				subscriberArray.splice(index, 1);
				return true;
			}
		});
	}

	async trigger(eventType, parameters=null) {
		if (!this._isValidEvent(eventType || Symbol("ARGUMENT_UNDEFINED"))) return;
		this._dispatch( new Event(eventType, parameters) );
	}
}

export {EventTypes, EventManager};