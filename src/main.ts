import './style.css';
import { createMap } from './ui/map';

const mapEl = document.getElementById('map');
if (!mapEl) throw new Error('#map element missing');

createMap(mapEl);
