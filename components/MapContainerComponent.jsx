import { useState, useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import styles from "./MapComponent.module.css"

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

export default function MapComponent({ location, onCoordinatesChange }) {
  const [coordinates, setCoordinates] = useState(null) // Initialize as null
  const defaultCoordinates = { lat: 27.7172, lng: 85.324 } // Default Kathmandu
  const debounceTimer = useRef(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (!location) {
      setCoordinates(null)
      return
    }
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            location
          )}`
        )
        const data = await res.json()
        if (data.length > 0) {
          const newCoordinates = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          }
          setCoordinates(newCoordinates)
          onCoordinatesChange(newCoordinates)
        } else {
          setCoordinates(null)
        }
      } catch (error) {
        setCoordinates(null)
      }
    }, 500)

    return () => clearTimeout(debounceTimer.current)
  }, [location, onCoordinatesChange])

  const displayCoordinates = coordinates || defaultCoordinates

  return (
    <div className={styles.mapContainer}>
      <MapContainer
        center={[displayCoordinates.lat, displayCoordinates.lng]}
        zoom={12}
        className={styles.leafletContainer}
        key={`${displayCoordinates.lat}-${displayCoordinates.lng}`} // remount map on coords change
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[displayCoordinates.lat, displayCoordinates.lng]}>
          <Popup>{location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}