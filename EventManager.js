"use strict";

// PUBLIC
const EventTypes = Object.freeze({
	"MEDIA_CONTROLLER_PLAYING": Symbol("MEDIA_CONTROLLER_PLAYING"),
	"MEDIA_CONTROLLER_PAUSED": Symbol("MEDIA_CONTROLLER_PAUSED"),
	"MEDIA_CONTROLLER_MUTED": Symbol("MEDIA_CONTROLLER_MUTED"),
	"MEDIA_CONTROLLER_VOLUME_CHANGE": Symbol("MEDIA_CONTROLLER_VOLUME_CHANGE"),
	"MEDIA_CONTROLLER_DURATION_CHANGED": Symbol("MEDIA_CONTROLLER_DURATION_CHANGED"),
	"MEDIA_CONTROLLER_TRACK_ROTATED": Symbol("MEDIA_CONTROLLER_TRACK_ROTATED"), // Data = Entry from ClientIndex.json
	"MEDIA_CONTROLLER_TRACK_ENDED": Symbol("MEDIA_CONTROLLER_TRACK_ENDED"),
	"MEDIA_CONTROLLER_LOADING_NEXT_TRACK": Symbol("MEDIA_CONTROLLER_LOADING_NEXT_TRACK"),
	"MEDIA_CONTROLLER_TRACK_PLAYABLE": Symbol("MEDIA_CONTROLLER_TRACK_PLAYABLE"),
	"MEDIA_CONTROLLER_METADATA_LOADED": Symbol("MEDIA_CONTROLLER_METADATA_LOADED"),
	"MEDIA_CONTROLLER_WAITING": Symbol("MEDIA_CONTROLLER_WAITING"),
	"MEDIA_CONTROLLER_STALLED": Symbol("MEDIA_CONTROLLER_STALLED"),
	"AUDIO_OBJECT_READY": Symbol("AUDIO_OBJECT_READY"),
	"AUDIO_OBJECT_OPEN": Symbol("AUDIO_OBJECT_OPEN"),
	"AUDIO_OBJECT_COMPLETED": Symbol("AUDIO_OBJECT_COMPLETED"),
	"AUDIO_OBJECT_DISPOSED": Symbol("AUDIO_OBJECT_DISPOSED"),
	"AUDIO_OBJECT_BUFFERING": Symbol("AUDIO_OBJECT_BUFFERING"),
	"AUDIO_OBJECT_BUFFER_UPDATED": Symbol("AUDIO_OBJECT_BUFFER_UPDATED"),
	"DATA_STREAM_CHUNK_RECEIVED": Symbol("DATA_STREAM_CHUNK_RECEIVED"),
	"DATA_STREAM_OPEN": Symbol("DATA_STREAM_OPEN"),
	"DATA_STREAM_CLOSED": Symbol("DATA_STREAM_CLOSED"),
	"DATA_STREAM_READING": Symbol("DATA_STREAM_READING"),
	"PLAYLIST_TRACKS_ADDED": Symbol("PLAYLIST_TRACKS_ADDED"), // {list: [], added: []}
	"PLAYLIST_TRACKS_REMOVED": Symbol("PLAYLIST_TRACKS_REMOVED"), // {list: [], removed: []}
	"ERROR": Symbol("ERROR") // {error_message: ""}
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