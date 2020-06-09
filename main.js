"use strict";

// const backendEntryPoint = "CFCs/AjaxProxy.cfc";

import { JSUtils } from "./Utils.js";
import * as EventScope from "./EventManager.js";
import { MediaController } from "./MediaController.js";
import { ServiceLocator } from "./ServiceLocator.js";
import { UI_Controller } from "./UI_Controller.js";
import { PlayList } from "./Playlist.js";

const Services = new ServiceLocator();

const Events = Object.create(null);
Events.manager = new EventScope.EventManager();
Events.types = EventScope.EventTypes;
Services.provide("events", Events);

const Indexes = {
	MasterAudioTrackIndex: {},
	AudioTrackIndexes: {
		ALBUMS: {},
		ARTISTS: {},
		GENRES: {}
	},
	BackendIndex: {}
};
Services.provide("indexes", Indexes);

const Playlist = new PlayList(Services);
Services.provide("playlist", Playlist);

const Player = new MediaController(Services);
Services.provide("player", Player);

const UIController = new UI_Controller(Services);
Services.lock();

const loadMusicIndex = function() {
	fetch("Data/ClientIndex.json", {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"})
	.then(response=> response.json())
	.then(jsonResponse=> {
		
		Indexes.MasterAudioTrackIndex = JSUtils.deepFreeze(jsonResponse);
		JSUtils.Log(`Client index loaded (${Object.keys(Indexes.MasterAudioTrackIndex).length} tracks)`);
		buildMusicIndexes();
	});

	fetch("Data/BackendIndex.json", {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error"})
	.then(response=> response.json())
	.then(jsonResponse=> {
		
		Indexes.BackendIndex = JSUtils.deepFreeze(jsonResponse);
		JSUtils.Log(`Backend index loaded (${Object.keys(Indexes.BackendIndex).length} tracks)`);
	});
}

const buildMusicIndexes = function() {
	// Instead of storing the trackID's, maybe store references to the tracks from the master index?
	for (let trackID in Indexes.MasterAudioTrackIndex) {
        let currentTrack = Indexes.MasterAudioTrackIndex[trackID];
        let albumHashCode = JSUtils.hash(currentTrack.Album); // Can't add artist because tracks may have different artists on the same album

		if (Indexes.AudioTrackIndexes.ALBUMS[albumHashCode]) 
			Indexes.AudioTrackIndexes.ALBUMS[albumHashCode].push(currentTrack);
		else
			Indexes.AudioTrackIndexes.ALBUMS[albumHashCode] = [currentTrack];

		if (Indexes.AudioTrackIndexes.ARTISTS[currentTrack.TrackArtists]) 
			Indexes.AudioTrackIndexes.ARTISTS[currentTrack.TrackArtists].push(currentTrack);
		else
			Indexes.AudioTrackIndexes.ARTISTS[currentTrack.TrackArtists] = [currentTrack];

		if (Indexes.AudioTrackIndexes.GENRES[currentTrack.Genres || "UNKNOWN"]) 
			Indexes.AudioTrackIndexes.GENRES[currentTrack.Genres || "UNKNOWN"].push(currentTrack);
		else
			Indexes.AudioTrackIndexes.GENRES[currentTrack.Genres || "UNKNOWN"] = [currentTrack];
	}

	Object.freeze(Indexes.AudioTrackIndexes.GENRES);
	Object.freeze(Indexes.AudioTrackIndexes.ALBUMS);
	Object.freeze(Indexes.AudioTrackIndexes.ARTISTS);
	Object.freeze(Indexes.AudioTrackIndexes);

	JSUtils.Log("Audio track indicies built");
}

// Debug mode, expose the stuff to the user so we can access stuff via the console
if (window.location.href.indexOf("?DevMode=1") > -1) {
	window.main = Object.seal({
		services: Services,
		events: Events,
		indexes: Indexes,
		playlist: Playlist,
		player: Player,
		uiController: UIController
	})
}

// Object.freeze(main);

window.onload = () => {
	UIController.init();
	loadMusicIndex();
	console.warn("Everything is initialized and ready to rock and roll");
}
