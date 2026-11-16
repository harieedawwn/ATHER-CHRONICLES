import React from 'react';
import { FighterSpec } from '../game/types';

interface FighterPortraitProps {
  spec: FighterSpec;
  size?: number;
}

export const FighterPortrait: React.FC<FighterPortraitProps> = ({ spec, size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="shrink-0 bg-[#060913] border border-slate-700/90"
      aria-hidden="true"
    >
      {/* Dynamic Diagonal Broadcast Backdrop */}
      <polygon points="0,48 48,10 48,48" fill={spec.accentColor} opacity="0.2" />
      <polygon points="0,0 28,0 0,28" fill={spec.secondaryColor} opacity="0.14" />

      {/* Character-Specific Back Aura / Halo Motif */}
      {spec.id === 'raijin' && (
        <g fill={spec.secondaryColor}>
          <circle cx="9" cy="15" r="2.2" />
          <circle cx="15" cy="7" r="2.2" />
          <circle cx="31" cy="7" r="2.2" />
          <circle cx="37" cy="15" r="2.2" />
        </g>
      )}
      {spec.id === 'chrono' && (
        <circle
          cx="22"
          cy="18"
          r="14"
          fill="none"
          stroke={spec.secondaryColor}
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
      )}
      {spec.id === 'sol' && (
        <polygon points="4,11 16,19 9,27" fill={spec.accentColor} opacity="0.9" />
      )}
      {spec.id === 'nyx' && (
        <g fill={spec.secondaryColor}>
          <polygon points="9,12 12,15 9,18 6,15" />
          <polygon points="39,9 42,12 39,15 36,12" />
        </g>
      )}
      {spec.id === 'jin' && (
        <g stroke={spec.secondaryColor} strokeWidth="1" opacity="0.8">
          <line x1="6" y1="6" x2="18" y2="28" />
          <line x1="42" y1="6" x2="31" y2="28" />
        </g>
      )}

      {/* Flowing Layered Cel-Shaded Scarf */}
      <path d="M14 28 L2 33 L4 41 L18 33 Z" fill="#04060c" />
      <path d="M14 29 L3 34 L5 40 L17 33 Z" fill={spec.scarfColor} />
      <path d="M14 29 L4 34 L6 36 L16 31 Z" fill={spec.secondaryColor} opacity="0.6" />

      {/* Sculpted Shoulders, Layered Chest Armor / Haori & High Collar */}
      <polygon
        points="8,47 11,29 16,26 28,26 33,29 36,47"
        fill="#04060c"
      />
      <polygon
        points="10,46 12,30 16,27 28,27 32,30 34,46"
        fill="#1e293b"
        stroke={spec.accentColor}
        strokeWidth="1.3"
      />
      {/* Lit Left Shoulder & Chest Lapel */}
      <polygon
        points="11,46 12.5,30 16.5,27.5 22,27.5 22,46"
        fill="#334155"
      />
      {/* V-Neck Inner Shirt & Center Lapel Trim */}
      <polygon points="18,27 26,27 22,38" fill="#0f172a" />
      <polyline
        points="17.5,27 22,38 26.5,27"
        fill="none"
        stroke={spec.secondaryColor}
        strokeWidth="1.2"
      />
      {/* Sculpted Neck & High Tactical Collar */}
      <polygon points="19,21 25,21 25.5,28 18.5,28" fill="#475569" />
      <polygon points="22,21 25,21 25.5,28 22,28" fill="#94a3b8" />
      <polygon
        points="16,25 18.5,28.5 25.5,28.5 28,25 26.5,30.5 17.5,30.5"
        fill="#0f172a"
        stroke={spec.accentColor}
        strokeWidth="1"
      />

      {spec.id === 'bram' && (
        <g>
          <polygon points="7,28 15,23 17,33 9,34" fill="#334155" stroke={spec.secondaryColor} strokeWidth="1.1" />
          <polygon points="37,28 29,23 27,33 35,34" fill="#334155" stroke={spec.secondaryColor} strokeWidth="1.1" />
          <polygon points="19,31 22,28 25,31 22,36" fill={spec.secondaryColor} />
        </g>
      )}
      {spec.id === 'kenji' && (
        <g>
          {/* Crossed Samurai Haori Lapels */}
          <line x1="15" y1="28" x2="26" y2="44" stroke={spec.accentColor} strokeWidth="1.6" />
          <line x1="29" y1="28" x2="19" y2="41" stroke={spec.secondaryColor} strokeWidth="1.2" />
        </g>
      )}
      {(spec.id === 'raijin' || spec.id === 'sol') && (
        <g>
          {/* Martial Sash / Solar Pauldrons */}
          <polygon points="9,28 15,25 16,32 10,32" fill={spec.accentColor} />
          <polygon points="35,28 29,25 28,32 34,32" fill={spec.accentColor} />
        </g>
      )}

      {/* Character-Specific Back Hair / Spikes / Hood */}
      {spec.id === 'kuro' && (
        <g>
          <polygon points="16,13 4,7 11,15 3,17 12,20 6,23 15,23" fill="#04060c" />
          <polygon points="16,14 6,8 12,15 5,17 13,20 8,22 15,22" fill="#312e81" stroke={spec.accentColor} strokeWidth="0.9" />
        </g>
      )}
      {spec.id === 'velo' && (
        <g>
          <polygon points="17,11 3,5 10,12 2,14 11,18 6,21 15,20" fill="#04060c" />
          <polygon points="16,12 5,6 11,13 4,15 13,18" fill={spec.secondaryColor} />
          <polygon points="17,10 8,5 13,11" fill="#ffffff" opacity="0.85" />
        </g>
      )}
      {spec.id === 'raijin' && (
        <polygon
          points="15,11 8,2 13,12 4,7 11,16 5,19 15,21"
          fill="#e0f2fe"
          stroke={spec.accentColor}
          strokeWidth="1"
        />
      )}
      {spec.id === 'sol' && (
        <g>
          <polygon
            points="26,11 23,1 19,8 11,2 14,11 5,8 12,19"
            fill={spec.accentColor}
            stroke="#04060c"
            strokeWidth="0.8"
          />
          <polygon points="24,12 20,4 15,11 10,8 15,17" fill={spec.secondaryColor} />
        </g>
      )}
      {spec.id === 'nyx' && (
        <path d="M14 12 Q4 23 8 41 L16 33 Z" fill="#2e1065" stroke={spec.accentColor} strokeWidth="1.1" />
      )}

      {/* Sculpted Anime Head & Angled Jawline (Replaces stickman circle) */}
      <path
        d="M13.5,14 C13.5,8.5 30.5,8.5 30.5,14 L29.5,20.5 L24,25.5 L19.5,25.5 L14.5,21 Z"
        fill="#04060c"
        stroke={spec.accentColor}
        strokeWidth="1.2"
      />
      {/* Shaded Cranium & Cheek Plane */}
      <path
        d="M14.8,14.2 C14.8,9.8 29.2,9.8 29.2,14.2 L28.4,20 L23.8,24.4 L19.8,24.4 L15.5,20.2 Z"
        fill="#334155"
      />
      {/* Lit Anime Face / Jaw Plane */}
      <polygon
        points="19.5,11.5 28.6,12.5 28.2,19.8 23.8,24.2 19.8,24.2 18.2,19.5"
        fill="#cbd5e1"
      />

      {/* Character-Distinct Headgear, Hats, Horns, Visors & Expressive Anime Eyes */}
      {spec.id === 'kuro' && (
        <g>
          {/* Shinobi Face Mask with Cel-Shaded Nose Bridge Fold */}
          <polygon points="14.5,18.5 29.2,17.8 27.8,24.8 19,24.8 15.2,21" fill="#1e1b4b" stroke={spec.accentColor} strokeWidth="0.8" />
          <polygon points="21.5,18.2 29,17.8 27.8,24.5 23.5,24.5" fill="#312e81" />
          {/* Swept Bangs & Headband */}
          <polygon points="14,13 30,12.5 29.5,15 14,15" fill={spec.accentColor} />
          <polygon points="16,11 23,9 29,12.5 25,15.5 19,13.5" fill="#1e1b4b" />
          {/* Sharp Glowing Eye + Pupil */}
          <polygon points="21.5,16.5 28.5,15 27.8,18 22,18" fill={spec.secondaryColor} />
          <rect x="25.2" y="15.5" width="1.8" height="2" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'velo' && (
        <g>
          {/* Swept Aerodynamic Hair & Cyber-Visor Goggles */}
          <polygon points="14,12 22,8 30,11 26,14 15,14" fill="#0284c7" />
          <polygon points="14.8,13.8 30.2,13.2 29.2,19 15,18.4" fill="#090d16" stroke={spec.accentColor} strokeWidth="0.9" />
          <polygon points="18.5,14.4 29.5,13.8 28.6,18 18.8,17.8" fill={spec.secondaryColor} />
          <polygon points="20,14.6 28.5,14.2 26,16 19.5,16.2" fill="#ffffff" opacity="0.9" />
          {/* Confident Smirk */}
          <line x1="22.5" y1="21.5" x2="26.5" y2="20.8" stroke="#0f172a" strokeWidth="1.1" />
        </g>
      )}

      {spec.id === 'kenji' && (
        <g>
          {/* Cheek Scar & Samurai Eye */}
          <line x1="21.5" y1="18.5" x2="20.5" y2="22.8" stroke="#991b1b" strokeWidth="1" />
          <polygon points="21.5,16.2 28,15.8 27.5,18.2 22,18.2" fill="#ffffff" />
          <rect x="24.2" y="16" width="2.4" height="2.2" fill={spec.secondaryColor} />
          {/* Woven Bamboo Ronin Kasa Hat with Bamboo Ribs */}
          <polygon
            points="3,15 22,4.5 39,15.5 32,16.5 11,16"
            fill="#1e293b"
            stroke={spec.accentColor}
            strokeWidth="1.4"
          />
          <line x1="22" y1="5" x2="11" y2="15" stroke={spec.accentColor} strokeWidth="0.8" opacity="0.7" />
          <line x1="22" y1="5" x2="31" y2="15.5" stroke={spec.accentColor} strokeWidth="0.8" opacity="0.7" />
          <rect x="19.5" y="4" width="5" height="2.4" fill={spec.secondaryColor} />
        </g>
      )}

      {spec.id === 'bram' && (
        <g>
          {/* Juggernaut Great-Helm, Slit Visor & Twin Curved Titan Horns */}
          <polygon points="14.5,18.5 29.5,18.5 28.5,25.5 15.5,25.5" fill="#1e293b" stroke={spec.accentColor} strokeWidth="1" />
          <line x1="19" y1="19.5" x2="19" y2="24.5" stroke="#090d16" strokeWidth="1.2" />
          <line x1="22.5" y1="19.5" x2="22.5" y2="24.5" stroke="#090d16" strokeWidth="1.2" />
          <line x1="26" y1="19.5" x2="26" y2="24.5" stroke="#090d16" strokeWidth="1.2" />
          <polygon points="19.5,15.2 28.8,14.8 28.2,17.8 20,17.8" fill={spec.secondaryColor} />
          <rect x="24.5" y="15.2" width="2.5" height="2" fill="#ffffff" />
          <path
            d="M17.5 13 Q10 4 24 2.5"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="2.8"
          />
        </g>
      )}

      {spec.id === 'raijin' && (
        <g>
          {/* Storm-God Oni Brow Band, Central Horn & Electric Eyes */}
          <rect x="14" y="12.5" width="16" height="2.4" fill={spec.secondaryColor} />
          <polygon points="22.5,13 31.5,2.5 26.8,14" fill={spec.secondaryColor} stroke="#ffffff" strokeWidth="0.6" />
          <polygon points="21.5,15.8 28.2,15.2 27.6,18.2 22,18.2" fill={spec.accentColor} />
          <rect x="25" y="15.6" width="2.2" height="2.2" fill="#ffffff" />
          {/* Grimacing Clenched Teeth */}
          <rect x="21.5" y="20.8" width="5" height="2" fill="#ffffff" stroke="#090d16" strokeWidth="0.5" />
        </g>
      )}

      {spec.id === 'chrono' && (
        <g>
          {/* Pointed Gothic Reaper Hood & Clockwork Monocle */}
          <polygon
            points="9,6 30.5,12.5 28.5,25 13.5,24.5 12,15"
            fill="#071318"
            stroke={spec.secondaryColor}
            strokeWidth="1.4"
          />
          <polygon points="14,12.5 27.5,14 26,23.5 16,23" fill="#04070d" />
          <circle
            cx="24.5"
            cy="17"
            r="3.4"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.3"
          />
          <rect x="23.4" y="15.9" width="2.2" height="2.2" fill={spec.accentColor} />
          <rect x="24.2" y="16.2" width="1.2" height="1.2" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'sol' && (
        <g>
          {/* Phoenix Golden Diadem Crest & Radiant Solar Eyes */}
          <polygon points="15.5,13 30.5,14.5 24,17.8" fill={spec.secondaryColor} />
          <polygon points="23.5,14 27,8.5 28.5,14.5" fill="#ffffff" />
          <polygon points="22,15.8 28.2,15.5 27.8,18.2 22.5,18.2" fill={spec.accentColor} />
          <rect x="24.5" y="16" width="2.5" height="2" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'nyx' && (
        <g>
          {/* Empress Crescent Horns, Star Crown & Astral Eyes */}
          <polygon points="15,12 29,11.5 28,15 16,14.5" fill="#4c1d95" />
          <path
            d="M18 11 Q13.5 3.5 19.5 2.5 M25.5 11 Q29.5 3.5 25 2.5"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.8"
          />
          <polygon points="24,10 25.8,12 24,14 22.2,12" fill="#ffffff" />
          <polygon points="21.5,15.8 28,15.4 27.5,18.2 22,18.2" fill={spec.accentColor} />
          <rect x="24.5" y="15.8" width="2.2" height="2.2" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'jin' && (
        <g>
          {/* Silver Swept Hair, Cyber-Kitsune Ears, High Mask & Triple-Slit Visor */}
          <polygon points="14,13 8,10 13,16 7,19 15,20" fill="#cbd5e1" />
          <polygon points="15.5,11.5 12.5,2.5 20,9.5 25.5,2.5 28,11.5" fill="#1e1b4b" stroke={spec.accentColor} strokeWidth="0.9" />
          <polygon points="14.5,10 13.5,4.5 18.5,9.5" fill={spec.secondaryColor} />
          <polygon points="23.5,9.5 25,4.5 26.8,10" fill={spec.secondaryColor} />
          <polygon
            points="14.5,18.5 29.5,18 28,25 16,25"
            fill="#0f172a"
            stroke={spec.accentColor}
            strokeWidth="1.1"
          />
          <rect x="21.5" y="14.2" width="6.5" height="1.4" fill={spec.secondaryColor} />
          <rect x="22.5" y="16.5" width="5.5" height="1.4" fill="#ffffff" />
        </g>
      )}

      {/* Hand-Crafted Masterwork Weapon Motifs in Foreground */}
      {spec.weaponType === 'katana' && (
        <g>
          {/* Curved Katana Blade + Golden Tsuba + Wrapped Hilt */}
          <path
            d="M33 38 Q39 22 44 6 L45.5 7 Q41 23 35 39 Z"
            fill={spec.accentColor}
          />
          <line x1="34.5" y1="38" x2="45" y2="7" stroke="#ffffff" strokeWidth="1" />
          <rect x="31" y="36" width="6" height="2.2" fill={spec.secondaryColor} />
        </g>
      )}
      {spec.weaponType === 'dagger' && (
        <g>
          {/* Ringed Abyssal Kunai Dagger */}
          <circle
            cx="33"
            cy="41"
            r="2.4"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.5"
          />
          <polygon points="34,37 39,28 45,19 42,31 37,39" fill={spec.secondaryColor} />
          <line x1="35" y1="37" x2="44" y2="20" stroke="#ffffff" strokeWidth="1" />
        </g>
      )}
      {spec.weaponType === 'gauntlet' && (
        <g>
          {/* Turbine Piston Gauntlet */}
          <polygon
            points="31,27 43,25 45,31 42,37 31,36"
            fill={spec.accentColor}
            stroke="#05070d"
            strokeWidth="1.2"
          />
          <rect x="39" y="27" width="3" height="8" fill={spec.secondaryColor} />
          <rect x="34" y="30" width="4" height="2.5" fill="#ffffff" />
        </g>
      )}
      {spec.weaponType === 'titan' && (
        <g>
          {/* 3-Clawed Siege Crusher Cestus */}
          <rect
            x="30"
            y="24"
            width="13"
            height="14"
            fill={spec.accentColor}
            stroke="#05070d"
            strokeWidth="1.4"
          />
          <polygon points="43,25 47,27 43,29" fill={spec.secondaryColor} />
          <polygon points="43,29 47,31 43,33" fill={spec.secondaryColor} />
          <polygon points="43,33 47,35 43,37" fill={spec.secondaryColor} />
          <rect x="34" y="28" width="4" height="5" fill="#ffffff" />
        </g>
      )}
      {spec.weaponType === 'spear' && (
        <g>
          {/* Raijin Thunder Naginata Polearm & Curved Halberd Blade */}
          <line x1="32" y1="44" x2="40" y2="18" stroke={spec.secondaryColor} strokeWidth="2.4" />
          <polygon points="37,19 43,19 40,15" fill={spec.secondaryColor} />
          <path d="M39 18 Q44 10 45 3 Q39 9 38 17 Z" fill={spec.accentColor} />
          <line x1="40" y1="17" x2="44.5" y2="4" stroke="#ffffff" strokeWidth="1" />
        </g>
      )}
      {spec.weaponType === 'scythe' && (
        <g>
          {/* Chrono Pendulum Great-Scythe: Snath + Clockwork Collar + Curved Crescent Blade */}
          <line x1="35" y1="45" x2="43" y2="11" stroke={spec.secondaryColor} strokeWidth="2.4" />
          <path
            d="M43 11 Q28 4 19 16 Q30 11 41 15 Z"
            fill={spec.accentColor}
            stroke="#05070d"
            strokeWidth="1"
          />
          <path
            d="M41 14 Q30 11 20 16"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.1"
          />
          <circle cx="42.5" cy="12" r="2.8" fill={spec.secondaryColor} />
        </g>
      )}
      {spec.weaponType === 'chains' && (
        <g>
          {/* Sol Interlocking Chain Links & 8-Spiked Morningstar Flail */}
          <line
            x1="31"
            y1="39"
            x2="40"
            y2="21"
            stroke={spec.secondaryColor}
            strokeWidth="2.4"
            strokeDasharray="3 2"
          />
          <polygon
            points="40,13 42,18 47,20 42,22 40,27 38,22 33,20 38,18"
            fill={spec.secondaryColor}
          />
          <circle cx="40" cy="20" r="4.2" fill={spec.accentColor} />
          <rect x="38.5" y="18.5" width="3" height="3" fill="#ffffff" />
        </g>
      )}
      {spec.weaponType === 'orbs' && (
        <g>
          {/* Nyx Astrolabe Ring & Multi-Faceted Star Prism */}
          <circle
            cx="39"
            cy="28"
            r="6.5"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.4"
          />
          <polygon points="39,20 42,28 39,36 36,28" fill={spec.accentColor} />
          <polygon points="31,28 39,25 47,28 39,31" fill={spec.accentColor} />
          <rect x="37.5" y="26.5" width="3" height="3" fill="#ffffff" />
        </g>
      )}
      {spec.weaponType === 'claws' && (
        <g>
          {/* Jin Curved 3-Talon Plasma Claws */}
          <rect x="31" y="34" width="6" height="6" fill={spec.accentColor} />
          <path
            d="M35 34 Q40 26 46 21 M36 37 Q41 29 47 25 M37 40 Q42 33 47 29"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.7"
          />
        </g>
      )}
    </svg>
  );
};
