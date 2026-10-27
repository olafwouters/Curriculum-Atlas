# Curriculum Compass v10 — brede matrix

Aparte release; v9 en de bestaande database zijn niet gewijzigd of gekopieerd.

## Starten
Sluit de oude lokale server met Control+C, pak de ZIP volledig uit, start Start-Mac.command / Start-Windows.bat / start-linux.sh. Python en dependencies zoals in v9 vereist. Importeer je bestaande JSON-export via Werkruimte & bestanden. Maak die export in v9 voordat je de server sluit.

## Wijzigingen
- App gebruikt vrijwel de hele browserbreedte. Matrixkolommen verdelen beschikbare ruimte; lange namen lopen door. Minimale kolombreedte bewaakt leesbaarheid; bij veel kolommen blijft horizontaal scrollen nodig.
- Navigatie in-/uitklapbaar met knop linksboven; volledige namen via toegankelijke namen en tooltips. Op mobiel kan het menu verborgen worden.
- Alle domeinen standaard open; elk afzonderlijk in-/uitklapbaar. Uitleg via aparte informatieknop behouden. Alle openen/sluiten beschikbaar. Keuze blijft behouden binnen de actieve pagina-sessie, niet na opnieuw starten.
- Matrix heeft geen vast intern verticaal scrollvak: verticale scroll volgt de pagina.
- Vaste modulekoppen verschijnen bij omlaag scrollen en volgen horizontale matrixscroll. Hun knoppen verwijzen naar dezelfde bestaande acties.
- Matrix vergroten verbergt overige navigatie en werkruimte-elementen; werkstand sluiten of Escape herstelt de normale weergave. Dit is geen browserfullscreen.
- Opslag, exports en mapping-formaat blijven ongewijzigd.

## Beperkingen
Geen visuele/interactieve browser- of schermlezertest beschikbaar; geen WCAG-conformiteitsclaim. Geen fix aan de alignmentdialoog inbegrepen. Zie TEST-RESULTS-v10.json.
