"use strict";

// PUBLIC
const EventTypes = Object.freeze({
	"INDEX_MANAGER_INDICES_BUILT": Symbol("INDEX_MANAGER_INDICES_BUILT"), // {tracks_parsed: number}
	"MEDIA_CONTROLLER_PLAYING": Symbol("MEDIA_CONTROLLER_PLAYING"), // void
	"MEDIA_CONTROLLER_PAUSED": Symbol("MEDIA_CONTROLLER_PAUSED"), // void
	"MEDIA_CONTROLLER_TRACK_ROTATED": Symbol("MEDIA_CONTROLLER_TRACK_ROTATED"), // {trackID: string, trackData: {}}
	"MEDIA_CONTROLLER_TRACK_ENDED": Symbol("MEDIA_CONTROLLER_TRACK_ENDED"), // {trackID_current: string, trackID_next: string}
    "MEDIA_CONTROLLER_LOADING_NEXT_TRACK": Symbol("MEDIA_CONTROLLER_LOADING_NEXT_TRACK"), // {trackID: string, rotateImmediately: boolean}
    "MEDIA_CONTROLLER_PREPARING_NEXT_TRACK": Symbol("MEDIA_CONTROLLER_PREPARING_NEXT_TRACK"), // void
	"MEDIA_CONTROLLER_TRACK_PLAYABLE": Symbol("MEDIA_CONTROLLER_TRACK_PLAYABLE"), // void
	"MEDIA_CONTROLLER_METADATA_LOADED": Symbol("MEDIA_CONTROLLER_METADATA_LOADED"), // void
	"MEDIA_CONTROLLER_WAITING": Symbol("MEDIA_CONTROLLER_WAITING"), // void
    "MEDIA_CONTROLLER_STALLED": Symbol("MEDIA_CONTROLLER_STALLED"), // void
	"MEDIA_CONTROLLER_SUSPENDED": Symbol("MEDIA_CONTROLLER_SUSPENDED"), // void
	"MEDIA_CONTROLLER_GAIN_CHANGED": Symbol("MEDIA_CONTROLLER_GAIN_CHANGED"), // {value: number, decibels: number}
	"MEDIA_CONTROLLER_DURATION_CHANGED": Symbol("MEDIA_CONTROLLER_DURATION_CHANGED"), // {duration: number}
	"MEDIA_CONTROLLER_BUFFER_UPDATED": Symbol("MEDIA_CONTROLLER_BUFFER_UPDATED"), // {ranges: object[] = {from: number, until: number}}
	"MEDIA_CONTROLLER_BUFFERING_ENDED": Symbol("MEDIA_CONTROLLER_BUFFERING_ENDED"),
	"MEDIA_CONTROLLER_SEEKING": Symbol("MEDIA_CONTROLLER_SEEKING"),
	"MEDIA_CONTROLLER_SEEK_ENDED": Symbol("MEDIA_CONTROLLER_SEEK_ENDED"),
	"MEDIA_CONTROLLER_STREAM_ABORTED": Symbol("MEDIA_CONTROLLER_STREAM_ABORTED"),
	"MEDIA_CONTROLLER_STREAM_URL_UNREACHABLE": Symbol("MEDIA_CONTROLLER_STREAM_URL_UNREACHABLE"), //  {streamURL: string, retry: number}
	"PLAYLIST_TRACKS_ADDED": Symbol("PLAYLIST_TRACKS_ADDED"), // {list: [], added: []}
	"PLAYLIST_TRACKS_REMOVED": Symbol("PLAYLIST_TRACKS_REMOVED"), // {list: [], removed: []}
	"PLAYLIST_SHUFFLED": Symbol("PLAYLIST_SHUFFLED"), // {list: []}
	"ERROR": Symbol("ERROR") // new Error()
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
        if (eventType.constructor.name !== Symbol.name) {
			console.error(`Event type is not a Symbol: ${eventType.constructor.name}`);
			return false;
		}

        if (!this.subscribers[eventType]) {
			console.error(`No such event type exists: ${eventType.description}`);
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