import { observable } from 'mobx';
import { Shop, ShopEntry } from './Shop';
import { Stat } from './Stat';

import Inventory from "./Inventory";
import Choice from "./Choice";
import Character from "./Character";
import Passage from "./Passage";
import Item from "./Item";
import * as _ from "lodash";
import * as marked from "marked";
import StoryConfig from "./StoryConfig";

export default class Story {
	static readonly PANEL_THEMES = [
		"rock", "rock-beige", "rock-light", "rock-dark",
		"frame-bronze", "frame-light", "frame-gold", "frame-dark",
		"parchment",
		"metal-blue", "metal-red", "metal-green", "metal-yellow",
		"blue", "red", "green", "yellow", "black", "chest"
	];

	character: Character;

	history: Passage[] = [];

	@observable currentPassage: Passage;
	@observable rendereredText: string;
	@observable choices: Choice[];
	@observable lootableInventory: Inventory;
	@observable error: string = null;
	@observable shop: Shop;
	@observable finished: boolean = false;

	get items(): Item[] {
		return this.config.items;
	}

	get stats(): Stat[] {
		return this.config.stats;
	}

    constructor(
		public name: string,
		public config: StoryConfig,
		public passages: Passage[],
		public startPassage
	) {

	}
	
	start() {
		this.character = new Character(this);

		// Expose some variables to the writer
		window.story = this;
		window.character = this.character;

		this.showPassage(this.startPassage);
	}

	choose(choice: Choice) {
		if (this.choices.indexOf(choice) == -1) {
			return;
		}

		this.showPassage(choice.passage);
	}

	addLootItem(itemTag: string): boolean {
		let item = this.getItem(itemTag);

		return this.addLootItemItem(item);	
	}

	addShopItem(itemTag: string, price: number) {
		let item = this.getItem(itemTag);

		this.addShopItemItem(item, price);
	}

	getItem(itemTag: string): Item {
		let item = this.items.filter(i => i.tag == itemTag)[0];
		if (item == null) {
			throw new Error("Couldn't find item with tag \"" + itemTag + "\"");
		}

		return item;
	}

	show(name: string) {
		let passage = this.passages.filter(p => p.name == name)[0];
		if (passage == null) {
			throw new Error("Couldn't find passage with name \"" + name + "\"");
		}

		this.showPassage(passage);
	}

	getStat(tag: string): Stat {
		let stat = this.stats.filter(s => s.name == tag)[0];
		if (stat == null) {
			throw new Error(`Couldn't find stat with name "${tag}"`);
		}

		return stat;
	}

	private addLootItemItem(item: Item): boolean {
		if (this.lootableInventory == null) {
			this.lootableInventory = new Inventory(this, 6);
		}

		return this.lootableInventory.add(item);
	}

	private addShopItemItem(item: Item, price: number) {
		if (this.shop == null) {
			this.shop = new Shop(this);
		}

		return this.shop.addItem(item, price);
	}

	private showPassage(passage: Passage) {
		// We flush the loot and things
		this.lootableInventory = null;
		this.shop = null;

		// First pass through lodash's template to execute
		// the inlined javascript code
		let processedText;
		try {
			processedText = _.template(passage.content)();
		} catch (e) {
			this.error = e.message;
			return;
		}

		// If the player is dead, we don't parse links (we only remove them)
		// and we add a single choice that will lead to the passage chosen by the writer
		let linkRegex = /\[\[(.+?)((->|\|)(.+?))?\]\]/gi;
		let choices: Choice[];
		if (!this.character.dead) {
			// Parsing links `[[...]]`
			// First, we find them
			choices = [];
			let currentMatch: RegExpExecArray;
			while ((currentMatch = linkRegex.exec(processedText)) != null) {
				console.log(currentMatch);
				// We first check if it is a link with 2 parts
				let name: string;
				let text: string;
				if (currentMatch[2] != null) {
					// 2 parts
					name = currentMatch[4];
					text = currentMatch[1];
				} else{
					// 1 part
					name = currentMatch[1];
					text = name;
				}
	
				let passage = this.passages.filter(p => p.name == name)[0];
	
				if (passage != null) {
					choices.push(new Choice(passage, marked(text)));
				} else {
					// The writer might have put a wrong passage name in the link,
					// we ignore it if it is the case
					// TODO: Display an error or something
					this.error = `Couldn't find any passage with the name "${name}"`;
				}
			}
		} else {
			// TODO: Find a way to let the writer customize the death passage
			choices = [
				new Choice(
					new Passage(45, "Final passage", ["theme-red", "button-red"], "[Insert thanks]"),
					this.config.deadMessage
				)
			];
		}
		this.choices = choices;

		// Then, we remove them
		processedText = processedText.replace(linkRegex, "");
		
		// We then transform the markdown
		this.rendereredText = marked(processedText);
		this.currentPassage = passage;

		this.history.push(passage);
	}

	private parseChoice(line: string): Choice {
		return null;
	}
}