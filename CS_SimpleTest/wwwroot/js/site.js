// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code

import * as d3 from 'd3'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
    
$(async function () {
    const data = await (await fetch('/data/data_file.json')).json();
    data.polygonsBySection.forEach(section =>
        $('#sections').append($('<option>',
            {
                value: section.sectionName,
                text: section.sectionName
            }
        ))
    )
    $("#sections").prepend("<option value='' selected='selected' disabled hidden>None</option>");

    /*2d*/
    const border = 1;
    const bordercolor = 'black';
    //svg
    const width = 800, height = 600, margin = 50;
    const svg = d3.select("#d3-chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("border", border)
        .attr("viewBox", `0 0 ${width} ${height}`)

    svg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", height)
        .attr("width", width)
        .style("stroke", bordercolor)
        .style("fill", "none")
        .style("stroke-width", border);    

    //clip path
    const clipPath = svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("x", margin)
        .attr("y", margin)
        .attr("width", width - 2 * margin)
        .attr("height", height - 2 * margin);


    //should be static, refs clip path and holds zoomables
    const graphGroup = svg.append("g")
        .attr("clip-path", "url(#clip)")  
    //zoomables, in which polygons are appended
    const zoomGroup = graphGroup.append("g");
    //graph border
    graphGroup.append("rect")
        .attr("x", margin)
        .attr("y", margin)
        .attr("height", height - 2 * margin)
        .attr("width", width - 2 * margin)
        .style("stroke", bordercolor)
        .style("fill", "none")
        .style("stroke-width", border);

    const zoom = d3.zoom()
        .scaleExtent([1, 5])
        .translateExtent([[margin, margin], [width - margin, height - margin]]) 
        .extent([[margin, margin], [width - margin, height - margin]])
        .on("zoom", handleZoom);
    svg.call(zoom)
        .on('wheel', e => e.preventDefault(), { passive: false });

    function handleZoom(e) {
        zoomGroup.attr("transform", e.transform);
        svg.select(".x-axis").attr("transform", `translate(0, ${margin})`).call(xAxis?.scale(e.transform.rescaleX(xScale)));
        svg.select(".y-axis").attr("transform", `translate(${margin}, 0)`).call(yAxis?.scale(e.transform.rescaleY(yScale)));
    }
    let xAxis = null, yAxis = null;
    let xScale = null, yScale = null;

    //select section
    $('#sections').on('change', async function (e) {
        svg.selectAll('polygon').remove();
        svg.select('.x-axis').remove();
        svg.select('.y-axis').remove();
        const selectedOption = $(this).find("option:selected");
        const section = data.polygonsBySection.find(section => section.sectionName === selectedOption.val());
        const minMaxes = computeMinMax(section);

        xScale = d3.scaleLinear().domain([minMaxes.minX, minMaxes.maxX]).range([margin, width - margin]);
        yScale = d3.scaleLinear().domain([minMaxes.minY, minMaxes.maxY]).range([height - margin, margin]);

        drawPolygons(d3, section, zoomGroup, xScale, yScale, "black", 1, 0.7);
        //drawGridLines(graphGroup, xScale, yScale, width, height, minMaxes.minX, minMaxes.maxX, minMaxes.minY, minMaxes.maxY);
        const axes = drawAxes(svg, xScale, yScale, width, height, margin);
        xAxis = axes.xAxis;
        yAxis = axes.yAxis;
    })


    /*3d*/
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);
    //camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(1000, 1000, 1000);
    //renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth / 1.5, window.innerHeight);
    $("#threejs-container").append(renderer.domElement);

    //controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.rotateSpeed = 0.75;
    controls.panSpeed = 1;
    controls.minDistance = 10;
    controls.maxDistance = 3000;

    //axes
    const axesHelper = new THREE.AxesHelper(500);
    scene.add(axesHelper);

    //grid
    let gridHelper = new THREE.GridHelper(100, 10);
    scene.add(gridHelper);

    //draw all polygons of all sections
    const sections = data.polygonsBySection;
    sections.forEach(section => {
        drawPolygons3D(scene, section);
    })
    //adjust grid to fit based on bounding box
    gridHelper = adjustGrid(scene, gridHelper);

    //animate
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    //resize
    $(window).on('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth / 1.5, window.innerHeight);
    });

});


function computeMinMax(section) {
    let minX = null, maxX = null, minY = null, maxY = null;

    section.polygons.forEach(polygon => {
       polygon.points2D.map(p => {
            const [x, y] = p.vertex;
            if (minX === null || x < minX) {
                minX = x;
            }
            if (maxX === null || x > maxX) {
                maxX = x;
            }
            if (minY === null || y < minY) {
                minY = y;
            }
            if (maxY === null || y > maxY) {
                maxY = y;
            }

        })
    })

    return { minX, maxX, minY, maxY };
}

function drawGridLines(graphGroup, xScale, yScale, width, height, minX, maxX, minY, maxY) {
    for (let i = minX; i <= maxX; i += 300) {  
        graphGroup.append("line")
            .attr("x1", xScale(i))
            .attr("y1", 0)
            .attr("x2", xScale(i))
            .attr("y2", height)
            .attr("stroke", "gray")
            .attr("stroke-width", 1);
    }

    for (let i = minY; i <= maxY; i += 75) {  
        graphGroup.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(i))
            .attr("x2", width)
            .attr("y2", yScale(i))
            .attr("stroke", "gray")
            .attr("stroke-width", 1);
    }
}

function drawPolygons(d3, section, zoomGroup, xScale, yScale, stroke, strokeWidth, opacity) {
    section.polygons.forEach((polygon, index) => {
        const color = `#${polygon.color}`;
        const points = polygon.points2D.map(p => {
            const [x, y] = p.vertex
            return [xScale(x), yScale(y)];
        });

        const pointsString = points.map(p => p.join(",")).join(" ");
        const thePolygon = zoomGroup.append("polygon")
            .attr("points", pointsString)
            .attr("fill", color)
            .attr("stroke", stroke)
            .attr("stroke-width", strokeWidth)
            .attr("opacity", opacity)
            .attr("index", index)
            .attr("clip-path", "url(#clip)")

        thePolygon.on('click', function (e) {
            const index = d3.select(this).attr("index");
            alert(`You clicked on Polygon at index ${index}`);
        })
    })
}


function drawAxes(svg, xScale, yScale, width, height, margin) {
    const xAxis = d3.axisTop(xScale).ticks(5); 
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${margin})`) 
        .call(xAxis);

    const yAxis = d3.axisLeft(yScale).ticks(5);
    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin}, 0)`) 
        .call(yAxis);

    svg.append("text")
        .attr("x", width/2)
        .attr("y", margin - 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .text("X");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .text("Y");

    return { xAxis, yAxis };
}



function drawPolygons3D(scene, section) {
    section.polygons.forEach(polygon => {
        const polyShape = new THREE.Shape(polygon.points3D.map(p => new THREE.Vector2(p.vertex[0], p.vertex[2])));
        const polyGeometry = new THREE.ShapeGeometry(polyShape);
        //set position of poly
        polyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(polygon.points3D.map(p => [p.vertex[0], p.vertex[1], p.vertex[2]]).flat(), 3));
        const poly3D = new THREE.Mesh(polyGeometry, new THREE.MeshBasicMaterial({ color: `#${polygon.color}`, side: THREE.DoubleSide }))
        poly3D.rotateX(3 * Math.PI / 2);
        scene.add(poly3D);
    });
}

function removePolygons3DByName(scene, name) {
    const objectsToRemove = scene.children.filter(obj => obj.name === name);
    objectsToRemove.forEach(obj => {
        scene.remove(obj);
        obj.geometry.dispose(); //free mem
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
}

function adjustGrid(scene, gridHelper) {
    let boundingBox = new THREE.Box3();

    scene.traverse((obj) => {
        if (obj.isMesh) {
            boundingBox.expandByObject(obj);
        }
    });

    let size = new THREE.Vector3();
    boundingBox.getSize(size);

    let gridSize = Math.max(size.x, size.z) * 1.5; //scale to ensure fit

    //old grid
    if (gridHelper) {
        scene.remove(gridHelper); 
    }

    //new grid
    gridHelper = new THREE.GridHelper(gridSize, Math.ceil(gridSize / 100));
    gridHelper.position.set(boundingBox.min.x + size.x / 2, 0, boundingBox.min.z + size.z / 2);

    scene.add(gridHelper);

    return gridHelper; 
}














