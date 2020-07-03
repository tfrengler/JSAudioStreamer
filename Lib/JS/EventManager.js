"use strict";

// PUBLIC
const EventTypes = Object.freeze({
	"INDEX_MANAGER_INDICES_BUILT": Symbol("INDEX_MANAGER_INDICES_BUILT"), // {tracks_parsed: number}
	"MEDIA_CONTROLLER_PLAYING": Symbol("MEDIA_CONTROLLER_PLAYING"), // void
	"MEDIA_CONTROLLER_PAUSED": Symbol("MEDIA_CONTROLLER_PAUSED"), // void
	"MEDIA_CONTROLLER_MUTED": Symbol("MEDIA_CONTROLLER_MUTED"), // {muted: boolean}
	"MEDIA_CONTROLLER_VOLUME_CHANGE": Symbol("MEDIA_CONTROLLER_VOLUME_CHANGE"), // {new_volume: number}
	"MEDIA_CONTROLLER_DURATION_CHANGED": Symbol("MEDIA_CONTROLLER_DURATION_CHANGED"), // {duration: number}
	"MEDIA_CONTROLLER_TRACK_ROTATED": Symbol("MEDIA_CONTROLLER_TRACK_ROTATED"), // {trackID: string, trackData: {}}
	"MEDIA_CONTROLLER_TRACK_ENDED": Symbol("MEDIA_CONTROLLER_TRACK_ENDED"), // {trackID_current: string, trackID_next: string}
    "MEDIA_CONTROLLER_LOADING_NEXT_TRACK": Symbol("MEDIA_CONTROLLER_LOADING_NEXT_TRACK"), // {trackID: string, rotateImmediately: boolean}
    "MEDIA_CONTROLLER_PREPARING_NEXT_TRACK": Symbol("MEDIA_CONTROLLER_PREPARING_NEXT_TRACK"), // void
	"MEDIA_CONTROLLER_TRACK_PLAYABLE": Symbol("MEDIA_CONTROLLER_TRACK_PLAYABLE"), // void
	"MEDIA_CONTROLLER_METADATA_LOADED": Symbol("MEDIA_CONTROLLER_METADATA_LOADED"), // void
	"MEDIA_CONTROLLER_WAITING": Symbol("MEDIA_CONTROLLER_WAITING"), // void
    "MEDIA_CONTROLLER_STALLED": Symbol("MEDIA_CONTROLLER_STALLED"), // void
	"MEDIA_CONTROLLER_BUFFERING_AHEAD": Symbol("MEDIA_CONTROLLER_BUFFERING_AHEAD"), // {bufferMark: number}
	"MEDIA_CONTROLLER_GAIN_CHANGED": Symbol("MEDIA_CONTROLLER_GAIN_CHANGED"), // {value: number, decibels: number}
	"AUDIO_OBJECT_READY": Symbol("AUDIO_OBJECT_READY"), // {object_url: string}
	"AUDIO_OBJECT_OPEN": Symbol("AUDIO_OBJECT_OPEN"), // void
	"AUDIO_OBJECT_COMPLETED": Symbol("AUDIO_OBJECT_COMPLETED"), // void
	"AUDIO_OBJECT_DISPOSED": Symbol("AUDIO_OBJECT_DISPOSED"), // {object_url: string, mediasource_state: string});
	"AUDIO_OBJECT_BUFFERING": Symbol("AUDIO_OBJECT_BUFFERING"), // {bufferMark: number}
	"AUDIO_OBJECT_BUFFER_UPDATED": Symbol("AUDIO_OBJECT_BUFFER_UPDATED"), // {buffered_until: number, buffered_from: number}
	"AUDIO_OBJECT_BUFFER_MARK_REACHED": Symbol("AUDIO_OBJECT_BUFFER_MARK_REACHED"), // {from: number, until: until}
	"DATA_STREAM_CHUNK_RECEIVED": Symbol("DATA_STREAM_CHUNK_RECEIVED"), // {bytes_read: number, bytes_total: number}
	"DATA_STREAM_OPEN": Symbol("DATA_STREAM_OPEN"), // void
	"DATA_STREAM_CLOSED": Symbol("DATA_STREAM_CLOSED"), // void
	"DATA_STREAM_READING": Symbol("DATA_STREAM_READING"), // void
	"PLAYLIST_TRACKS_ADDED": Symbol("PLAYLIST_TRACKS_ADDED"), // {list: [], added: []}
	"PLAYLIST_TRACKS_REMOVED": Symbol("PLAYLIST_TRACKS_REMOVED"), // {list: [], removed: []}
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