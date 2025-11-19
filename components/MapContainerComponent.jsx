'use client';
import { useEffect, useRef, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import './MapContainerComponent.css';

const MapContainerComponent = ({ mapData }) => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const leafletMarkersRef = useRef([]);
  const baseIconSize = 20;

  // Prepare marker data
  const markersData = useMemo(() => {
    if (!mapData || mapData.length === 0) return [];

    console.log("mapData", mapData);
    return mapData.map((item) => ({
      id: item.id,
      pos: [parseFloat(item.latitude), parseFloat(item.longitude)],

      name: item.name,     
      picture: item.picture,
      points: item.points,
      description: item.description,

      // popupDouble: {
      //   description: item.doubleDescription || '',
      //   image: item.doublePicture || '/images/default.png',
      //   video: item.video || '',
      //   audio: item.audio || ''
      // }
    }));
  }, [mapData]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let L;
    (async () => {
      L = await import('leaflet');

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });

      if (!mapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [27.7172, 85.3240],
          zoom: 14,
          attributionControl: false,
        });
        mapRef.current = map;

        L.tileLayer(
          `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=o5HKmzYWt25adtDkDQQK`,
          { attribution: '' }
        ).addTo(map);

        map.on('zoom', () => {
          const zoom = map.getZoom();
          const scale = zoom / 14;
          const newSize = baseIconSize * scale;
          leafletMarkersRef.current.forEach((marker) =>
            marker.setIcon(createQrIcon(newSize, L))
          );
        });

        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            ({ coords: { latitude: lat, longitude: lng } }) => {
              if (!userMarkerRef.current) {
                const userMarker = L.circleMarker([lat, lng], {
                  radius: 4,
                  color: 'red',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8,
                }).addTo(map);
                userMarker.bindPopup('<b>You are here!</b>');
                userMarkerRef.current = userMarker;
                userMarker.openPopup();
              } else {
                userMarkerRef.current.setLatLng([lat, lng]);
              }
            },
            (err) => console.error('Geolocation error:', err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      }

      // Custom QR marker icon
      function createQrIcon(size, L) {
        return L.icon({
          iconUrl: '/images/navPointLogo.png',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [size / 2 + 15, 0],
          className: 'qr-marker',
        });
      }

      // Clear previous markers
      leafletMarkersRef.current.forEach((marker) => marker.remove());
      leafletMarkersRef.current = [];

      // Add new markers
      markersData.forEach((m) => {
        const marker = L.marker(m.pos, { icon: createQrIcon(baseIconSize, L) }).addTo(mapRef.current);

        //  On marker click → open fullscreen popup
        marker.on('click', () => {
          const popupHTML = `
            <div class="popup-scanner-style">
              <div class="popup-content-wrapper">
                <div class="popup-image-container">
                  ${m.picture ? `<img src="${m.picture}" class="popup-image" />` : ""}
                </div>
                <div class="popup-title">${m.name}</div>                
                <div class="popup-points">Points: ${m.points}</div>
                <hr>
                <div class="popup-description">${m.description}</div>
                <div class="popup-btn-container">
                  <button id="popup-close-${m.id}" class="popup-close-btn">view on map</button>
                </div>
              </div>
            </div>
          `;
          document.body.insertAdjacentHTML("beforeend", popupHTML);

          // Close popup when clicking close button
          document.getElementById(`popup-close-${m.id}`).addEventListener("click", () => {
            document.querySelector(".popup-scanner-style")?.remove();
          });
        });

        leafletMarkersRef.current.push(marker);
      });
    })();
  }, [markersData]);

  return (
    <div className="map-wrapper">
      <div className="map-container" ref={mapContainerRef}></div>
    </div>
  );
};

export default MapContainerComponent;
