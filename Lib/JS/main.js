"use strict";

import * as EventScope from "./EventManager.js";
import { MediaController } from "./MediaController.js";
import { ServiceLocator } from "./ServiceLocator.js";
import { UI_Controller } from "./UI_Controller.js";
import { PlayList } from "./Playlist.js";
import { IndexManager } from "./IndexManager.js";

const Config = await fetch("Data/Config.json", {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error", headers: {"Accept": "application/json"}})
.then(response=> response.json())
.catch(error=>
	{
		console.log(error);
		throw new Error("Failed to load config-file!!!");
	}
);
console.log("Config loaded succesfully");

const Services = new ServiceLocator();

const Events = Object.create(null);
Events.manager = new EventScope.EventManager();
Events.types = EventScope.EventTypes;
Services.provide("events", Events);

const Indexes = new IndexManager("Data", Services);
Services.provide("indexes", Indexes);

const Playlist = new PlayList(Services);
Services.provide("playlist", Playlist);

const Player = new MediaController(Config.BackendEntryPoint, Services);
Services.provide("player", Player);

const UIController = new UI_Controller(Services);
Services.lock();

window.DevMode = false;
// Debug mode, expose the stuff to the user so we can access stuff via the console
if (window.location.href.indexOf("?DevMode=1") > -1)
{
	window.main = Object.seal({
		services: Services,
		events: Events,
		indexes: Indexes,
		playlist: Playlist,
		player: Player,
		uiController: UIController
	});

	window.DevMode = true;
}

UIController.init();

Indexes.load().then(()=> {
	if (localStorage.getItem("playlist"))
		Playlist.add(localStorage.getItem("playlist").split("|"));
});

console.warn("Everything is initialized and ready to rock and roll");