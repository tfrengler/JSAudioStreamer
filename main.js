"use strict";

// const backendEntryPoint = "CFCs/AjaxProxy.cfc";
const main = Object.create(null);

import { JSUtils } from "./Utils.js";
import * as EventScope from "./EventManager.js";
import { MediaController } from "./MediaController.js";
import { ServiceLocator } from "./ServiceLocator.js";
import { UIController } from "./UI_Controller.js";

let Services = new ServiceLocator();

let Events = Object.create(null);
Events.manager = new EventScope.EventManager();
Events.types = EventScope.EventTypes;
Services.provide("events", Events);

let Indexes = {
	MasterAudioTrackIndex: {},
	AudioTrackIndexes: {
		ALBUMS: {},
		ARTISTS: {},
		GENRES: {}
	},
	BackendIndex: {}
};
Services.provide("indexes", Indexes);

main.player = new MediaController(Services);
Services.provide("player", main.player);

main.uiController = new UIController(Services);

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

		if (Indexes.AudioTrackIndexes.ALBUMS[currentTrack.Album]) 
			Indexes.AudioTrackIndexes.ALBUMS[currentTrack.Album].push(currentTrack);
		else
			Indexes.AudioTrackIndexes.ALBUMS[currentTrack.Album] = [currentTrack];

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
	window.main = main;
	window.main.indexes = Indexes;
}

// Object.freeze(main);

window.onload = () => {
	main.uiController.init();
	loadMusicIndex();
	console.warn("Everything is initialized and ready to rock and roll");
}
