PROJECT: CHARTED TERRITORY (Beta Specification)
Version: 1.0 (Web Architecture) Goal: A browser-based geopolitical sandbox where players draw a country’s borders on a map, and the game generates the diplomatic, economic, and cultural consequences.

1. TECHNICAL STACK (Strict Constraints)
Use these exact libraries. Do not hallucinate alternative engines.

Frontend Framework: React 18+ (Vite)

Language: TypeScript (Strict Mode)

Map Engine: mapbox-gl-js (v2 or v3)

Drawing Tool: @mapbox/mapbox-gl-draw

Geometry Logic: @turf/turf (Critical for calculating intersections)

State Management: Zustand (for game state)

Styling: Tailwind CSS (for UI overlay)

2. CORE ARCHITECTURE
A. The "Layer Cake"
The Base Layer (Mapbox): Renders the physical world (Satellite/Terrain style).

The Logic Layer (GeoJSON): Hidden data layer containing existing countries, cities, and major infrastructure.

The Interaction Layer (Mapbox Draw): The canvas where the user paints their polygon.

The Calculation Layer (Turf.js): Runs on Draw.create. Calculates Area(User) ∩ Area(France).

B. Data Structure
Country Object:

TypeScript

interface Country {
  id: string; // "FRA"
  name: string; // "France"
  geometry: Polygon | MultiPolygon;
  attributes: {
    population: number;
    gdp_per_capita: number;
    dominant_culture: string;
    allies: string[];
    rivals: string[];
  }
}
GameEvent Object:

TypeScript

interface DiplomaticEvent {
  type: "LANDLOCK_WARNING" | "CULTURE_SPLIT" | "RESOURCE_SEIZURE";
  severity: 1 | 2 | 3;
  description: string; // "You have cut off Switzerland from the Rhine river trade."
  affected_nations: string[];
}
3. PHASE 1: THE DRAWING MECHANIC (The "Vibe Code" Prompts)
Copy-paste these prompts into your AI tool to build the specific modules.

Prompt 1: The Map Setup
"Initialize a React project with Vite. Install mapbox-gl, @mapbox/mapbox-gl-draw, and @turf/turf. Create a component GameMap.tsx. Initialize a full-screen Mapbox instance using a satellite style. Add the Draw control to the top-right. Ensure the map does not reset pitch/bearing when the user drags."

Prompt 2: The "Severance" Logic (The Core Magic)
"Create a utility function calculateConsequences(userPolygon, worldGeoJSON).

Use turf.intersect to find which countries the userPolygon overlaps.

For each overlapped country, calculate the percentage of land taken (area(intersection) / area(original)).

If the percentage is > 0, push an object to a consequences array: { country: 'Name', lost_percentage: 0.X }.

Return this array and log it to the console when the user finishes drawing."

4. PHASE 2: THE AI LOGIC SYSTEMS
A. The "Lung" System (Sea Access)
Algorithm:

Check if a country was touching the ocean before the draw.

Check if the turf.difference(country, userPolygon) touches the ocean after the draw.

If Before == True AND After == False: Trigger Immediate War Warning.

B. The "Heart" System (Cultural Integrity)
Implementation: Use the "Points in Polygon" method.

Load a generic dataset of cities (Vector Tiles or local JSON).

When the user draws, run turf.pointsWithinPolygon(cities, userPolygon).

Sum the population of captured cities.

Logic:

If CapturedPop > 10,000,000: You are a Great Power.

If CapturedCities includes "Paris": France gains "Revanchism" modifier (+100% Aggression).

5. PHASE 3: GAMEPLAY LOOP & UI
The "Paperwork" Phase (UI)
After the drawing is complete, freeze the map and open the Constitution Modal.

Inputs:

Name: [User Input]

Flag: [Auto-generated based on dominant terrain colors]

Capital: [User clicks a location inside their new border]

The "News Ticker" Component
A scrolling feed at the bottom of the screen reacting to the turf analysis.

Template: "{CountryName} condemns the annexation of {RegionName}!"

Template: "{CountryName} praises the restoration of order in {RegionName}."

6. DEVELOPMENT ROADMAP FOR AI
Step 1: Get the map rendering with a simple polygon draw tool. (Target: 1 hour) Step 2: Load a simplified GeoJSON of "World Borders" (Natural Earth Low Res). (Target: 1 hour) Step 3: Implement the turf.intersect logic to console log "You stole 50% of Germany." (Target: 2 hours) Step 4: Build the React UI to display these stats nicely. (Target: 2 hours) Step 5: Add the "News Ticker" LLM generation to describe the consequences. (Target: 2 hours)

7. RESOURCE LINKS FOR THE AI
If the AI gets stuck, provide these URLs for context:

Mapbox Draw API: https://github.com/mapbox/mapbox-gl-draw

Turf.js Docs: https://turfjs.org/docs/

Data Source: https://geojson.xyz/ (Use ne_110m_admin_0_countries.geojson for the prototype).