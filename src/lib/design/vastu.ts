import { getCatalogItem } from "./catalog";
import { dimsOf, footprint, occupiesFloor } from "./layout";
import type { Placement, Room, Rotation } from "./types";

// Plan orientation (matches the 2D/3D views): y = 0 is the north wall, x = 0 the west wall.
export type Zone = "NW" | "N" | "NE" | "W" | "C" | "E" | "SW" | "S" | "SE";
type Direction = "N" | "E" | "S" | "W";

export interface VastuCheck {
	placementId?: string;
	status: "good" | "warn" | "bad";
	message: string;
}

export interface VastuReport {
	score: number;
	checks: VastuCheck[];
}

interface VastuRule {
	ideal: Zone[];
	avoid?: Zone[];
	reason: string;
	orientation?: {
		// Models face +Z (south) at rot 0; "front" is where you sit, "back" is the bed head.
		side: "front" | "back";
		label: string;
		subject: string;
		ideal: Direction[];
		reason: string;
	};
}

const BED_RULE: VastuRule = {
	ideal: ["SW", "S", "W"],
	avoid: ["NE", "C"],
	reason: "the south-west (earth) zone gives stability for rest",
	orientation: {
		side: "back",
		label: "head points",
		subject: "the head points",
		ideal: ["S", "E"],
		reason: "sleeping with the head to the north is avoided",
	},
};

const STORAGE_RULE: VastuRule = {
	ideal: ["SW", "S", "W"],
	avoid: ["NE"],
	reason: "heavy storage belongs on the south or west side",
};

const RULES: Record<string, VastuRule> = {
	"bed-queen": BED_RULE,
	"bed-single": BED_RULE,
	wardrobe: STORAGE_RULE,
	bookshelf: STORAGE_RULE,
	"study-table": {
		ideal: ["N", "E", "NE"],
		reason: "the north and east support focus and learning",
		orientation: {
			side: "back",
			label: "you face",
			subject: "you face",
			ideal: ["N", "E"],
			reason: "study facing north or east",
		},
	},
	sofa: {
		ideal: ["S", "W", "SW"],
		avoid: ["NE"],
		reason: "main seating sits best along the south or west walls",
		orientation: {
			side: "front",
			label: "you face",
			subject: "you face",
			ideal: ["N", "E"],
			reason: "seated guests should face north or east",
		},
	},
	"tv-unit": {
		ideal: ["SE", "E"],
		avoid: ["NE", "SW"],
		reason: "electronics belong to the south-east (fire) zone",
	},
	"floor-lamp": {
		ideal: ["SE", "S", "E"],
		reason: "light sources suit the south-east (fire) zone",
	},
	plant: {
		ideal: ["N", "E", "NE"],
		avoid: ["SW"],
		reason: "plants bring growth energy to the north and east",
	},
	"dining-table": {
		ideal: ["W", "NW", "E"],
		avoid: ["C"],
		reason: "dining is favoured in the west",
	},
};

// Items that follow another item's rule.
const RULE_ALIASES: Record<string, string> = {
	"bunk-bed": "bed-queen",
	"drawer-cabinet": "wardrobe",
	"sofa-fabric": "sofa",
	"sofa-grand": "sofa",
	"corner-sofa": "sofa",
	armchair: "sofa",
	"lounge-chair": "sofa",
	"tv-flat": "tv-unit",
	"tv-vintage": "tv-unit",
	"tv-retro": "tv-unit",
	speaker: "tv-unit",
	"floor-lamp-square": "floor-lamp",
	"plant-small": "plant",
	"plant-potted": "plant",
	"round-table": "dining-table",
};

function ruleFor(catalogId: string): VastuRule | undefined {
	return RULES[catalogId] ?? RULES[RULE_ALIASES[catalogId]];
}

const ZONE_NAMES: Record<Zone, string> = {
	NW: "north-west",
	N: "north",
	NE: "north-east",
	W: "west",
	C: "centre (Brahmasthan)",
	E: "east",
	SW: "south-west",
	S: "south",
	SE: "south-east",
};

const DIRECTION_NAMES: Record<Direction, string> = {
	N: "north",
	E: "east",
	S: "south",
	W: "west",
};

const FRONT: Record<Rotation, Direction> = {
	0: "S",
	90: "E",
	180: "N",
	270: "W",
};
const OPPOSITE: Record<Direction, Direction> = {
	N: "S",
	S: "N",
	E: "W",
	W: "E",
};

export function zoneOf(room: Room, x: number, y: number): Zone {
	const row = y < room.length / 3 ? "N" : y > (room.length * 2) / 3 ? "S" : "";
	const col = x < room.width / 3 ? "W" : x > (room.width * 2) / 3 ? "E" : "";
	return (row + col || "C") as Zone;
}

function listNames(
	zones: Array<Zone | Direction>,
	names: Record<string, string>,
) {
	return zones.map((zone) => names[zone]).join(" or ");
}

function coversCentre(room: Room, placement: Placement) {
	const { width, depth } = footprint(placement);
	return (
		Math.abs(placement.x - room.width / 2) < width / 2 &&
		Math.abs(placement.y - room.length / 2) < depth / 2
	);
}

// Pass `checks` to collect human-readable feedback; omit it for fast scoring.
function evaluate(room: Room, placements: Placement[], checks?: VastuCheck[]) {
	let total = 0;
	let counted = 0;
	let centreBlocked = false;
	for (const placement of placements) {
		const item = getCatalogItem(placement.catalogId);
		const rule = ruleFor(item.id);
		const zone = zoneOf(room, placement.x, placement.y);
		const heavy = occupiesFloor(placement) && dimsOf(placement).height >= 0.7;
		let score: number | null = null;

		if (rule) {
			const zoneScore = rule.ideal.includes(zone)
				? 1
				: rule.avoid?.includes(zone)
					? 0.2
					: 0.6;
			score = zoneScore;
			if (checks) {
				if (zoneScore === 1)
					checks.push({
						placementId: placement.id,
						status: "good",
						message: `${item.name} is in the ${ZONE_NAMES[zone]}: ${rule.reason}.`,
					});
				else
					checks.push({
						placementId: placement.id,
						status: zoneScore < 0.5 ? "bad" : "warn",
						message: `Move the ${item.name.toLowerCase()} from the ${ZONE_NAMES[zone]} to the ${listNames(rule.ideal, ZONE_NAMES)}: ${rule.reason}.`,
					});
			}
			if (rule.orientation) {
				const front = FRONT[placement.rot];
				const direction =
					rule.orientation.side === "front" ? front : OPPOSITE[front];
				const facingOk = rule.orientation.ideal.includes(direction);
				score = zoneScore * 0.65 + (facingOk ? 1 : 0.4) * 0.35;
				if (checks && !facingOk)
					checks.push({
						placementId: placement.id,
						status: "warn",
						message: `${item.name}: ${rule.orientation.label} ${DIRECTION_NAMES[direction]}. Rotate so ${rule.orientation.subject} ${listNames(rule.orientation.ideal, DIRECTION_NAMES)}; ${rule.orientation.reason}.`,
					});
			}
		}

		if (heavy && zone === "NE" && !rule?.avoid?.includes("NE")) {
			score = (score ?? 1) * 0.4;
			checks?.push({
				placementId: placement.id,
				status: "bad",
				message: `Keep the north-east light and open; move the ${item.name.toLowerCase()} elsewhere.`,
			});
		}
		if (heavy && coversCentre(room, placement)) {
			centreBlocked = true;
			score = (score ?? 1) * 0.4;
			checks?.push({
				placementId: placement.id,
				status: "bad",
				message: `The ${item.name.toLowerCase()} blocks the Brahmasthan (room centre), which should stay open.`,
			});
		}

		if (score !== null) {
			total += score;
			counted += 1;
		}
	}
	if (checks && placements.length > 0 && !centreBlocked)
		checks.push({
			status: "good",
			message: "The Brahmasthan (room centre) is kept open.",
		});
	return counted > 0 ? total / counted : 1;
}

export function vastuScore(room: Room, placements: Placement[]) {
	return evaluate(room, placements);
}

export function vastuReport(room: Room, placements: Placement[]): VastuReport {
	const checks: VastuCheck[] = [];
	const score = evaluate(room, placements, checks);
	const order = { bad: 0, warn: 1, good: 2 };
	checks.sort((a, b) => order[a.status] - order[b.status]);
	return { score, checks };
}
