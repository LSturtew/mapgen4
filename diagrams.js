// From http://www.redblobgames.com/maps/mapgen2/
// Copyright 2017 Red Blob Games <redblobgames@gmail.com>
// License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>

/* global makeRandFloat, makeRandInt */

'use strict';

const SEED = 123456788;
const TriangleMesh = require('@redblobgames/triangle-mesh');
const createMesh =   require('@redblobgames/triangle-mesh/create');
const SimplexNoise = require('simplex-noise');
const util =         require('./algorithms/util');
const Water =        require('./algorithms/water');
const Elevation =    require('./algorithms/elevation');
const Rivers =       require('./algorithms/rivers');
const Moisture =     require('./algorithms/moisture');
const Biomes =       require('./algorithms/biomes');

let noise = new SimplexNoise(makeRandFloat(SEED));
const mesh_10 = new TriangleMesh(createMesh(10.0, makeRandFloat(SEED)));
const mesh_15 = new TriangleMesh(createMesh(15.0, makeRandFloat(SEED)));
const mesh_30 = new TriangleMesh(createMesh(30.0, makeRandFloat(SEED)));
const mesh_50 = new TriangleMesh(createMesh(50.0, makeRandFloat(SEED)));
const mesh_75 = new TriangleMesh(createMesh(75.0, makeRandFloat(SEED)));

const biomeColors = {
    OCEAN: "#44447a",
    COAST: "#33335a",
    LAKESHORE: "#225588",
    LAKE: "#336699",
    RIVER: "#225588",
    MARSH: "#2f6666",
    ICE: "#99ffff",
    BEACH: "#a09077",
    SNOW: "#ffffff",
    TUNDRA: "#bbbbaa",
    BARE: "#888888",
    SCORCHED: "#555555",
    TAIGA: "#99aa77",
    SHRUBLAND: "#889977",
    TEMPERATE_DESERT: "#c9d29b",
    TEMPERATE_RAIN_FOREST: "#448855",
    TEMPERATE_DECIDUOUS_FOREST: "#679459",
    GRASSLAND: "#88aa55",
    SUBTROPICAL_DESERT: "#d2b98b",
    TROPICAL_RAIN_FOREST: "#337755",
    TROPICAL_SEASONAL_FOREST: "#559944",
};

function drawArrow(ctx, p, q) {
    const stemLength = 0.5;
    const headLength = 0.5;
    const stemWidth = 0.15;
    const headWidth = 0.4;
    const tailLength = 0.1;
    
    let s = [util.mix(p[0], q[0], 0.2), util.mix(p[1], q[1], 0.2)];
    let dx = (q[0] - p[0]) * 0.7;
    let dy = (q[1] - p[1]) * 0.7;

    ctx.beginPath();
    ctx.moveTo(s[0] + dx*tailLength, s[1] + dy*tailLength);
    ctx.lineTo(s[0] - dy*stemWidth, s[1] + dx*stemWidth);
    ctx.lineTo(s[0] + dx*stemLength - dy*stemWidth, s[1] + dy*stemLength + dx*stemWidth);
    ctx.lineTo(s[0] + dx*(1-headLength) - dy*headWidth, s[1] + dy*(1-headLength) + dx*headWidth);
    ctx.lineTo(s[0] + dx, s[1] + dy);
    ctx.lineTo(s[0] + dx*(1-headLength) + dy*headWidth, s[1] + dy*(1-headLength) - dx*headWidth);
    ctx.lineTo(s[0] + dx*stemLength + dy*stemWidth, s[1] + dy*stemLength - dx*stemWidth);
    ctx.lineTo(s[0] + dy*stemWidth, s[1] - dx*stemWidth);
    ctx.lineTo(s[0] + dx*tailLength, s[1] + dy*tailLength);
    ctx.fill();
}


function setCanvasStyle(ctx, style, defaults) {
    const globalCanvasStyle = {
        globalAlpha: 1.0,
        lineWidth: 1.0,
        fillStyle: "black",
        strokeStyle: "black"
    };
    Object.assign(ctx, globalCanvasStyle);
    Object.assign(ctx, defaults);
    Object.assign(ctx, style);
}

let layers = {};

layers.triangleEdges = (style) => (ctx, mesh) => {
    setCanvasStyle(ctx, style, {strokeStyle: "black", lineWidth: 1.0});
    for (let e = 0; e < mesh.numSolidEdges; e++) {
        let v0 = mesh.e_begin_v(e);
        let v1 = mesh.e_end_v(e);
        ctx.beginPath();
        ctx.moveTo(mesh.vertices[v0][0], mesh.vertices[v0][1]);
        ctx.lineTo(mesh.vertices[v1][0], mesh.vertices[v1][1]);
        ctx.stroke();
    }
};

layers.triangleEdgesColored = (style, coloring) => (ctx, mesh) => {
    setCanvasStyle(ctx, style, {strokeStyle: "black", lineWidth: 1.0});
    for (let e = 0; e < mesh.numSolidEdges; e++) {
        let v0 = mesh.e_begin_v(e);
        let v1 = mesh.e_end_v(e);
        let color = coloring(e, v0, v1);
        if (color) {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(mesh.vertices[v0][0], mesh.vertices[v0][1]);
            ctx.lineTo(mesh.vertices[v1][0], mesh.vertices[v1][1]);
            ctx.stroke();
        }
    }
};

layers.polygonEdges = (style) => (ctx, mesh) => {
    setCanvasStyle(ctx, style, {strokeStyle: "white", lineWidth: 1.5});
    for (let e = 0; e < mesh.numEdges; e++) {
        let v0 = mesh.e_begin_v(e);
        let v1 = mesh.e_end_v(e);
        let t0 = mesh.e_inner_t(e);
        let t1 = mesh.e_outer_t(e);
        if (t0 > t1) {
            ctx.beginPath();
            ctx.moveTo(mesh.centers[t0][0], mesh.centers[t0][1]);
            ctx.lineTo(mesh.centers[t1][0], mesh.centers[t1][1]);
            ctx.stroke();
        }
    }
};

layers.polygonEdgesColored = (style, coloring) => (ctx, mesh) => {
    setCanvasStyle(ctx, style, {lineWidth: 2.0});
    for (let e = 0; e < mesh.numEdges; e++) {
        let v0 = mesh.e_begin_v(e);
        let v1 = mesh.e_end_v(e);
        let t0 = mesh.e_inner_t(e);
        let t1 = mesh.e_outer_t(e);
        if (t0 > t1) {
            let color = coloring(e, v0, v1, t0, t1);
            if (color) {
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.moveTo(mesh.centers[t0][0], mesh.centers[t0][1]);
                ctx.lineTo(mesh.centers[t1][0], mesh.centers[t1][1]);
                ctx.stroke();
            }
        }
    }
};

layers.triangleCenters = (style) => (ctx, mesh) => {
    const radius = style.radius || 5;
    setCanvasStyle(ctx, style, {fillStyle: "hsl(230,50%,50%)", strokeStyle: "white", lineWidth: 1.0});
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        ctx.beginPath();
        ctx.arc(mesh.centers[t][0], mesh.centers[t][1], radius, 0, 2*Math.PI);
        ctx.stroke();
        ctx.fill();
    }
};

layers.triangleCentersLabeled = (style, labeling) => (ctx, mesh) => {
    const fontheight = 18;
    setCanvasStyle(ctx, style, {fillStyle: "black"});
    ctx.font = `${fontheight}px sans-serif`;
    ctx.textAlign = "center";
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        let label = labeling(t);
        if (label) {
            ctx.fillText(label, mesh.centers[t][0], mesh.centers[t][1] + fontheight*0.4);
        }
    }
};

layers.triangleCentersColored = (style, coloring) => (ctx, mesh) => {
    const radius = style.radius || 5;
    setCanvasStyle(ctx, style, {});
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        let color = coloring(t);
        if (color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(mesh.centers[t][0], mesh.centers[t][1], radius, 0, 2*Math.PI);
            ctx.stroke();
            ctx.fill();
        }
    }
};

layers.polygonCenters = (style) => (ctx, mesh) => {
    const radius = style.radius || 5;
    setCanvasStyle(ctx, style, {fillStyle: "hsl(0,50%,50%)", strokeStyle: "hsl(0,0%,75%)", lineWidth: 3.0});
    for (let v = 0; v < mesh.numSolidVertices; v++) {
        ctx.beginPath();
        ctx.arc(mesh.vertices[v][0], mesh.vertices[v][1], mesh.v_boundary(v) ? radius/2 : radius, 0, 2*Math.PI);
        ctx.stroke();
        ctx.fill();
    }
};

/* coloring should be a function from v (polygon) to color string */
layers.polygonColors = (style, coloring) => (ctx, mesh) => {
    const radius = style.radius || 5;
    let out_t = [];
    setCanvasStyle(ctx, style, {});
    for (let v = 0; v < mesh.numSolidVertices; v++) {
        mesh.v_circulate_t(out_t, v);
        ctx.fillStyle = coloring(v);
        ctx.beginPath();
        ctx.moveTo(mesh.centers[out_t[0]][0], mesh.centers[out_t[0]][1]);
        for (let i = 1; i < out_t.length; i++) {
            ctx.lineTo(mesh.centers[out_t[i]][0], mesh.centers[out_t[i]][1]);
        }
        ctx.fill();
    }
};

layers.drawDrainage = (style, v_ocean, t_downslope_e) => (ctx, mesh) => {
    setCanvasStyle(ctx, style, {fillStyle: "hsl(230,50%,50%)", lineWidth: 30});
    for (let t1 = 0; t1 < mesh.numSolidTriangles; t1++) {
        let e = t_downslope_e[t1];
        if (e !== -1 && v_ocean[mesh.e_begin_v(e)]) { continue; }
        let t2 = e === -1? t1 : mesh.e_outer_t(e);
        if (t1 !== t2) {
            drawArrow(ctx, mesh.centers[t1], mesh.centers[t2]);
        }
    }
};
    
layers.drawRivers = (style, e_flow) => (ctx, mesh) => {
    setCanvasStyle(ctx, {}, {lineWidth: 2.5, strokeStyle: "hsl(230,50%,50%)"});
    let baseLineWidth = ctx.lineWidth;
    for (let e = 0; e < mesh.numEdges; e++) {
        if (e_flow[e] > 0) {
            ctx.lineWidth = baseLineWidth * Math.sqrt(e_flow[e]);
            let v0 = mesh.e_begin_v(e);
            let v1 = mesh.e_end_v(e);
            let t0 = mesh.e_inner_t(e);
            let t1 = mesh.e_outer_t(e);
            ctx.beginPath();
            ctx.moveTo(mesh.centers[t0][0], mesh.centers[t0][1]);
            ctx.lineTo(mesh.centers[t1][0], mesh.centers[t1][1]);
            ctx.stroke();
        }
    }
};

layers.drawSprings = (style, river_t) => (ctx, mesh) => {
    setCanvasStyle(ctx, {}, {lineWidth: 1.0, fillStyle: "white", strokeStyle: "hsl(230,50%,50%)"});
    for (let t of river_t) {
        ctx.beginPath();
        ctx.arc(mesh.centers[t][0], mesh.centers[t][1], 3, 0, 2*Math.PI);
        ctx.fill();
        ctx.stroke();
    }
};
            

/* layers should be a list of functions that take (ctx, mesh) and draw the layer;
 * or null to skip that layer */
function diagram(canvas, mesh, options, layers) {
    const scale = util.fallback(options.scale, 1.0);
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width/1000, canvas.height/1000);
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.translate(500, 500); ctx.scale(scale, scale); ctx.translate(-500, -500);
    ctx.fillStyle = "hsl(60, 5%, 75%)";
    ctx.fillRect(0, 0, 1000, 1000);

    for (let layer of layers) {
        if (layer) { layer(ctx, mesh); }
    }
    
    ctx.restore();
}

function createCircumcenterMesh(mesh, mixture) {
    let centers = [], out_v = [];
    for (var t = 0; t < mesh.numSolidTriangles; t++) {
        mesh.t_circulate_v(out_v, t);
        let a = mesh.vertices[out_v[0]],
            b = mesh.vertices[out_v[1]],
            c = mesh.vertices[out_v[2]];
        let center = util.circumcenter(a, b, c);
        centers.push([util.mix(mesh.centers[t][0], center[0], mixture),
                      util.mix(mesh.centers[t][1], center[1], mixture)]);
    }
    for (; t < mesh.numTriangles; t++) {
        centers.push(mesh.centers[t]);
    }
    let newMesh = new TriangleMesh(mesh);
    newMesh.centers = centers;
    return newMesh;
}


function makeDiagram(selector, object) {
    object.container = document.querySelector(selector);
    object.canvas = object.container.querySelector("canvas");
    
    object.show = 'all';
    object.setShow = function(value) {
        object.show = value;
        object.redraw();
    };

    let spans = object.container.querySelectorAll(".hover-term");
    for (let span of spans) {
        span.addEventListener('mouseover', () => {
            object.setShow(span.getAttribute('data-show'));
        });
    }

    object.buttons = object.container.querySelectorAll("button");
    for (let button of object.buttons) {
        let name = button.getAttribute('name');
        object.buttons[name] = button;
        button.addEventListener('click', () => {
            object[name].apply(object);
            object.redraw();
        });
    }
    
    object.sliders = object.container.querySelectorAll("input[type='range']");
    for (let slider of object.sliders) {
        let name = slider.getAttribute('name');
        object.sliders[name] = slider;
        slider.value = object[name];
        slider.addEventListener('input', () => {
            object[name] = slider.valueAsNumber;
            object.redraw();
        });
    }

    object.recalculate = function() {
        this.v_water = Water.assign_v_water(this.mesh, util.fallback(this.noise, noise), {round: util.fallback(this.round, 0.5), inflate: util.fallback(this.inflate, 0.5)});
        this.v_ocean = Water.assign_v_ocean(this.mesh, this.v_water);
        this.elevationdata = Elevation.assign_t_elevation(this.mesh, this.v_ocean, this.v_water, makeRandInt(util.fallback(this.drainageSeed, SEED)));
        this.t_coastdistance = this.elevationdata.t_distance;
        this.t_elevation = this.elevationdata.t_elevation;
        this.t_downslope_e = this.elevationdata.t_downslope_e;
        this.v_elevation = Elevation.assign_v_elevation(this.mesh, this.t_elevation, this.v_ocean);
        this.spring_t = util.randomShuffle(Rivers.find_spring_t(this.mesh, this.v_water, this.t_elevation, this.t_downslope_e), makeRandInt(util.fallback(this.riverSeed, SEED)));
        this.river_t = this.spring_t.slice(0, util.fallback(this.numRivers, 5));
        this.e_flow = Rivers.assign_e_flow(this.mesh, this.t_downslope_e, this.river_t, this.t_elevation);
        this.v_moisture = Moisture.assign_v_moisture(this.mesh, this.v_water, Moisture.find_moisture_seeds_v(this.mesh, this.e_flow, this.v_ocean, this.v_water));
        this.v_biome = Biomes.assign_v_biome(this.mesh, this.v_ocean, this.v_water, this.v_elevation, this.v_moisture, util.fallback(this.temperatureBias, 0), util.fallback(this.moistureBias, 0));
    };
    
    object.redraw();
    return object;
}


let diagramMeshConstruction = makeDiagram(
    "#diagram-mesh-construction", {
        centroidCircumcenterMix: 0.0,
        mesh: mesh_75,
        redraw() {
            let show = this.show;
            diagram(this.canvas,
                    createCircumcenterMesh(this.mesh, this.centroidCircumcenterMix),
                    {scale: 0.9},
                    [
                        layers.triangleEdges({globalAlpha: show==='all'||show==='delaunay'?1.0:show==='centroids'?0.3:0.1, lineWidth: 1.0}),
                        layers.polygonEdges({globalAlpha: show==='all'||show==='polygons'?1.0:0.1, strokeStyle: "hsl(0,0%,95%)", lineWidth: 4.0}),
                        layers.polygonCenters({globalAlpha: show==='all'||show==='delaunay'||show==='points'?1.0:0.2, radius: 7}),
                        layers.triangleCenters({globalAlpha: show==='all'||show==='polygons'||show==='centroids'?1.0:0.2})
                    ]);
        },
    });


let diagramWaterAssignment = makeDiagram(
    "#diagram-water-assignment", {
        round: 0.5,
        inflate: 0.5,
        mesh: mesh_30,
        redraw() {
            this.recalculate();
            let show = this.show;
            let {v_water, v_ocean} = this;
            if (show === 'landwater') { v_ocean = v_water; }
            diagram(
                this.canvas, this.mesh, {},
                [
                    layers.polygonColors({}, (v) => v_ocean[v]? "hsl(230,30%,50%)" : v_water[v]? (show === 'lakes'? "hsl(200,100%,50%)" : "hsl(200,30%,50%)") : "hsl(30,15%,60%)"),
                    layers.polygonEdges({strokeStyle: "black"}),
                    (show === 'connectivity' || show === 'lakes') && layers.triangleEdgesColored({globalAlpha: show === 'lakes'? 0.3 : 1.0}, (_, v0, v1) => v_ocean[v0] && v_ocean[v1]? "white" : null),
                    show === 'all' && layers.polygonEdgesColored({lineWidth: 6.0}, (_, v0, v1, t0, t1) => v_ocean[v0] !== v_ocean[v1]? "black" : null),
                    layers.polygonCenters({radius: 1.0, fillStyle: "hsl(0,0%,50%)", strokeStyle: "hsl(0,0%,50%)"})
                ]);
        },
    });


let diagramElevationAssignment = makeDiagram(
    "#diagram-elevation-assignment", {
        mesh: mesh_30,
        redraw() {
            this.recalculate();
            let {show, mesh, v_water, v_ocean, v_elevation, t_elevation, t_coastdistance} = this;
            let coasts_t = Elevation.find_coasts_t(this.mesh, v_ocean);

            function polygonColoring(v) {
                if (v_ocean[v]) {
                    return `hsl(230,25%,${50+30*v_elevation[v]}%)`;
                } else if (v_water[v]) {
                    return `hsl(230,${15-10*v_elevation[v]}%,${60+30*v_elevation[v]}%)`;
                } else {
                    return `hsl(30,${25-10*v_elevation[v]}%,${50+50*v_elevation[v]}%)`;
                }
            }
            let config = null;
            switch (show) {
            case 'coast_t': config = [
                layers.polygonColors({}, (v) => v_ocean[v]? "hsl(230,30%,60%)" : v_water[v]? "hsl(230,30%,60%)" : "hsl(30,15%,60%)"),
                layers.polygonEdgesColored({lineWidth: 1.5}, (_, v0, v1) => v_ocean[v0] !== v_ocean[v1]? "black" : null),
                layers.triangleCentersColored({radius: 5, strokeStyle: "white"}, (t) => coasts_t.indexOf(t) >= 0? "black" : null)
            ];
                break;
            case 't_coastdistance': config = [
                layers.polygonColors({}, (v) => v_ocean[v]? "hsl(230,30%,60%)" : v_water[v]? "hsl(230,30%,60%)" : "hsl(30,20%,60%)"),
                layers.polygonEdges({strokeStyle: "black", lineWidth: 1.0, globalAlpha: 0.4}),
                layers.triangleCentersLabeled({}, (t) => ""+t_coastdistance[t])
            ];
                break;
            case 't_elevation': config = [
                layers.polygonColors({}, (v) => v_ocean[v]? "hsl(230,30%,60%)" : "hsl(30,20%,60%)"),
                layers.polygonEdgesColored({lineWidth: 1.5}, (_, v0, v1) => v_ocean[v0] !== v_ocean[v1]? "black" : null),
                layers.triangleEdgesColored(
                    {globalAlpha: 0.3}, (e) => {
                        let t0 = mesh.e_inner_t(e);
                        let t1 = mesh.e_outer_t(e);
                        return (Math.round(3*t_elevation[t0]) != Math.round(3*t_elevation[t1]))? "black" : null;
                    }
                ),
                layers.triangleCentersColored(
                    {radius: 5, strokeStyle: "white"}, (t) =>
                        t_elevation[t] == 0? "black"
                        : t_elevation[t] < 0? `hsl(230,50%,${-100*t_elevation[t]}%)`
                        : `hsl(60,25%,${100*t_elevation[t]}%)`)
            ];
                break;
            default: config = [
                layers.polygonColors({}, polygonColoring),
                layers.polygonEdgesColored({lineWidth: 1.0},
                                           (e, v0, v1) => Math.round(3*v_elevation[v0]) != Math.round(3*v_elevation[v1])? "black" : null),
                layers.polygonEdgesColored({lineWidth: 2.5}, (e, v0, v1) => v_ocean[v0] != v_ocean[v1]? "black" : null),
                layers.polygonCenters({radius: 0.5, fillStyle: "black", strokeStyle: "black"})
            ];
            }
            diagram(this.canvas, this.mesh, {}, config);
        },
    });


let diagramDrainageAssignment = makeDiagram(
    "#diagram-drainage-assignment", {
        mesh: mesh_30,
        drainageSeed: 1,
        changeDrainageSeed() {
            this.drainageSeed = makeRandInt(this.drainageSeed)(100000);
        },
        redraw() {
            this.recalculate();
            let {show, mesh, v_water, v_ocean, v_elevation, t_elevation, t_downslope_e, t_coastdistance} = this;
            
            function polygonColoring(v) {
                if (v_ocean[v]) {
                    return `hsl(230,25%,${50+30*v_elevation[v]}%)`;
                } else if (v_water[v]) {
                    return `hsl(230,${15-10*v_elevation[v]}%,${60+30*v_elevation[v]}%)`;
                } else {
                    return `hsl(30,${25-10*v_elevation[v]}%,${50+50*v_elevation[v]}%)`;
                }
            }
            
            diagram(this.canvas, mesh, {}, [
                layers.polygonColors({}, polygonColoring),
                layers.drawDrainage({}, v_ocean, t_downslope_e),
                layers.polygonEdgesColored({lineWidth: 2.0}, (_, v0, v1) => v_ocean[v0] !== v_ocean[v1]? "black" : null),
            ]);
        },
    });


let diagramRivers = makeDiagram(
    "#diagram-rivers", {
        mesh: mesh_30,
        numRivers: 5,
        riverSeed: 1,
        addRivers()       { this.numRivers += 10; },
        reset()           { this.numRivers = 0; },
        changeRiverSeed() { this.riverSeed = makeRandInt(this.riverSeed)(100000); },
        redraw() {
            this.recalculate();
            let {show, mesh, v_water, v_ocean, v_elevation, t_downslope_e, spring_t, e_flow} = this;
            this.sliders.numRivers.setAttribute('max', spring_t.length);

            function polygonColoring(v) {
                if (v_ocean[v]) {
                    return `hsl(230,25%,${50+30*v_elevation[v]}%)`;
                } else if (v_water[v]) {
                    return `hsl(230,${15-10*v_elevation[v]}%,${60+30*v_elevation[v]}%)`;
                } else {
                    return `hsl(30,${25-10*v_elevation[v]}%,${50+50*v_elevation[v]}%)`;
                }
            }
            
            diagram(this.canvas, mesh, {}, [
                layers.polygonColors({}, polygonColoring),
                layers.drawDrainage({globalAlpha: 0.2}, v_ocean, t_downslope_e),
                layers.drawRivers({}, e_flow),
                layers.drawSprings({}, spring_t),
                layers.polygonEdgesColored({lineWidth: 2.0}, (_, v0, v1) => v_ocean[v0] !== v_ocean[v1]? "black" : null),
            ]);
        }
    });


let diagramMoistureAssignment = makeDiagram(
    "#diagram-moisture-assignment", {
        mesh: mesh_15,
        numRivers: 1,
        addRivers() { this.numRivers += 5; },
        reset() { this.numRivers  = 0; },
        redraw() {
            this.recalculate();
            let {show, mesh, v_water, v_ocean, v_elevation, t_downslope_e, e_flow, spring_t, river_t, v_moisture} = this;
            this.sliders.numRivers.setAttribute('max', spring_t.length);
            function polygonColoring(v) {
                if (v_ocean[v]) {
                    return "hsl(230,25%,25%)";
                } else if (v_water[v]) {
                    return "hsl(230,50%,50%)";
                } else {
                    return `hsl(${30+120*v_moisture[v]},15%,${75-25*v_moisture[v]}%)`;
                }
            }
            
            let config = null;
            diagram(this.canvas, mesh, {}, [
                layers.polygonColors({}, polygonColoring),
                layers.drawRivers({}, e_flow),
                layers.drawSprings({}, river_t),
                layers.polygonEdgesColored({lineWidth: 1.5}, (_, v0, v1) => v_ocean[v0] !== v_ocean[v1]? "black" : null),
                layers.polygonEdgesColored({lineWidth: 0.3}, (_, v0, v1) => Math.round(5*v_moisture[v0]) != Math.round(5*v_moisture[v1]) ? "black" : null),
            ]);
        }
    });


let diagramBiomeAssignment = makeDiagram(
    "#diagram-biome-assignment", {
        mesh: mesh_10,
        seed: 1,
        noise: noise,
        numRivers: 5,
        temperatureBias: 0.0,
        moistureBias: 0.0,
        addRivers() { this.numRivers += 10; },
        reset() { this.numRivers  = 0; },
        nextSeed() { this.setSeed(this.seed+1); },
        prevSeed() { this.setSeed(this.seed-1); },
        setSeed(value) { this.seed = value; this.noise = new SimplexNoise(makeRandFloat(this.seed)); this.redraw(); },
        redraw() {
            this.recalculate();
            this.sliders.numRivers.setAttribute('max', this.spring_t.length);
            
            let v_biome = this.v_biome;
            diagram(this.canvas, this.mesh, {}, [
                layers.polygonColors({}, (v) => biomeColors[v_biome[v]] || "red"),
                layers.polygonEdgesColored({lineWidth: 1.5}, (_, v0, v1) => (v_biome[v0] === 'OCEAN') !== (v_biome[v1] === 'OCEAN')? "black" : null),
                layers.polygonEdgesColored({lineWidth: 0.3}, (_, v0, v1) => v_biome[v0] !== v_biome[v1]? "black" : null),
                layers.drawRivers({lineWidth: 0.5}, this.e_flow),
            ]);
        }
    });


let mapExport = makeDiagram(
    "#map-export", {
        mesh: mesh_75,
        redraw() { },
        export() {
            this.recalculate();
            let mesh = this.mesh;
            let t_points = mesh.centers.map((p, t) => [Math.round(p[0]), Math.round(p[1]), this.t_elevation[t]]);
            let v_points = mesh.vertices.map((p, v) => [Math.round(p[0]), Math.round(p[1]), this.v_elevation[v]]);
            let v_biomes = this.v_biome;
            let v_moisture = this.v_moisture;
            let t_triangles_v = [];
            let v_polygons_t = [];
            for (let t = 0; t < mesh.numSolidTriangles; t++) {
                t_triangles_v.push(mesh.t_circulate_v([], t));
            }
            for (let v = 0; v < mesh.numSolidVertices; v++) {
                v_polygons_t.push(mesh.v_circulate_t([], v));
            }
            this.container.querySelector("textarea").value = JSON.stringify({v_biomes, t_triangles_v, v_polygons_t, t_points, v_points, v_moisture}, null, " ");
        },
    });
