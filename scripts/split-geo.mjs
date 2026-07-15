import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const geoRoot = path.join(root, "public", "geo")
const continentDir = path.join(geoRoot, "continents")
const adminDir = path.join(geoRoot, "admin1")
fs.mkdirSync(continentDir, { recursive: true })
fs.mkdirSync(adminDir, { recursive: true })

const countries = JSON.parse(fs.readFileSync(path.join(geoRoot, "countries-10m.geojson"), "utf8"))
const admin1 = JSON.parse(fs.readFileSync(path.join(geoRoot, "admin1-10m.geojson"), "utf8"))
const continentFiles = {
  Asia: "asia",
  Europe: "europe",
  Oceania: "oceania",
  "North America": "north-america",
  "South America": "south-america",
  Africa: "africa",
}

for (const [continent, file] of Object.entries(continentFiles)) {
  const features = countries.features.filter(feature => feature.properties.CONTINENT === continent)
  fs.writeFileSync(path.join(continentDir, `${file}.geojson`), JSON.stringify({ type: "FeatureCollection", features }))
}

const supportedCountries = [
  "JPN", "THA", "IDN", "VNM", "CHN", "KOR",
  "ITA", "FRA", "ISL", "ESP", "CHE", "NOR",
  "NZL", "AUS", "FJI", "USA", "CAN", "MEX", "CRI",
  "BRA", "ARG", "PER", "CHL",
  "ZAF", "EGY", "MAR", "KEN", "TZA",
]

for (const code of supportedCountries) {
  const features = admin1.features.filter(feature => feature.properties.adm0_a3 === code)
  fs.writeFileSync(path.join(adminDir, `${code.toLowerCase()}.geojson`), JSON.stringify({ type: "FeatureCollection", features }))
}

console.log(`Wrote ${Object.keys(continentFiles).length} continent files and ${supportedCountries.length} admin files.`)
