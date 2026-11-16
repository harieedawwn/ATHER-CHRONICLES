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

      {/* Flowing Scarf */}
      <path d="M14 29 L3 34 L5 40 L17 33 Z" fill={spec.scarfColor} />

      {/* Sculpted Shoulders, Chest Armor & Collar */}
      <polygon
        points="11,46 14,27 30,27 33,46"
        fill={spec.bodyColor}
        stroke={spec.accentColor}
        strokeWidth="1.6"
      />
      {spec.id === 'bram' && (
        <g fill={spec.secondaryColor}>
          <polygon points="9,28 15,24 16,32 10,33" />
          <polygon points="35,28 29,24 28,32 34,33" />
        </g>
      )}

      {/* Character-Specific Back Hair / Spikes / Hood */}
      {spec.id === 'kuro' && (
        <polygon points="15,15 6,9 11,17 5,19 14,22" fill={spec.accentColor} />
      )}
      {spec.id === 'velo' && (
        <polygon points="16,12 5,6 10,13 4,15 14,19" fill={spec.secondaryColor} />
      )}
      {spec.id === 'raijin' && (
        <polygon
          points="15,12 9,4 13,13 5,9 11,17 6,19 15,21"
          fill="#e0f2fe"
          stroke={spec.accentColor}
          strokeWidth="0.8"
        />
      )}
      {spec.id === 'sol' && (
        <g>
          <polygon
            points="25,11 22,2 19,9 12,3 15,12 7,9 13,19"
            fill={spec.accentColor}
          />
          <polygon points="23,12 20,5 15,12 11,9 15,17" fill={spec.secondaryColor} />
        </g>
      )}
      {spec.id === 'nyx' && (
        <path d="M14 14 Q6 24 9 39 L16 32 Z" fill={spec.accentColor} opacity="0.85" />
      )}

      {/* Head Base with Crisp Anime Outline */}
      <circle cx="22" cy="18" r="9" fill={spec.accentColor} />
      <circle cx="22" cy="18" r="7.5" fill={spec.bodyColor} />

      {/* Character-Distinct Headgear, Hats, Horns, Visors & Eyes */}
      {spec.id === 'kuro' && (
        <g>
          {/* Shinobi Face Mask */}
          <polygon points="14,19 30,18 28,25 16,25" fill="#1e1b4b" />
          <rect x="14" y="13" width="15" height="2" fill={spec.accentColor} />
          <polygon points="22,16.5 28.5,14.8 27.5,17.8" fill={spec.secondaryColor} />
          <rect x="25" y="15.5" width="1.8" height="1.8" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'velo' && (
        <g>
          {/* Speedster Cyber-Visor Goggles */}
          <polygon points="15,14 30,13.5 29,19 15,18.5" fill="#0f172a" />
          <polygon points="19,14.5 29.5,14 28.5,18 19,17.8" fill={spec.secondaryColor} />
          <rect x="24" y="14.8" width="3.5" height="1.5" fill="#ffffff" />
          <polygon points="18,16 9,12 13,18" fill={spec.accentColor} />
        </g>
      )}

      {spec.id === 'kenji' && (
        <g>
          {/* Blazing Samurai Eye under Woven Ronin Kasa Hat */}
          <rect x="22" y="16.5" width="5.5" height="2.2" fill={spec.secondaryColor} />
          <rect x="25" y="16.5" width="2" height="1.8" fill="#ffffff" />
          <polygon
            points="5,14 22,5 37,15"
            fill="#1e293b"
            stroke={spec.accentColor}
            strokeWidth="1.5"
          />
          <rect x="19.5" y="4.5" width="5" height="2.2" fill={spec.secondaryColor} />
        </g>
      )}

      {spec.id === 'bram' && (
        <g>
          {/* Juggernaut Jawplate & Twin Curved Titan Horns */}
          <rect x="15" y="19" width="14" height="6.5" fill="#1e293b" />
          <rect x="16.5" y="20.5" width="11" height="3.5" fill={spec.accentColor} />
          <rect x="21" y="15.5" width="7" height="2.5" fill={spec.secondaryColor} />
          <path
            d="M18 13 Q11 4 24 3"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="2.8"
          />
        </g>
      )}

      {spec.id === 'raijin' && (
        <g>
          {/* Storm-God Oni Brow Band & Central Lightning Horn */}
          <rect x="14.5" y="13" width="15" height="2" fill={spec.secondaryColor} />
          <polygon points="23,13 31,3 26.5,14" fill={spec.secondaryColor} />
          <rect x="22.5" y="16" width="5.5" height="2.4" fill={spec.accentColor} />
          <rect x="25.5" y="16" width="2" height="2" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'chrono' && (
        <g>
          {/* Pointed Gothic Reaper Hood & Clockwork Monocle */}
          <polygon
            points="10,7 30,13 28,25 14,24"
            fill="#071318"
            stroke={spec.secondaryColor}
            strokeWidth="1.4"
          />
          <circle
            cx="24.5"
            cy="17"
            r="3.2"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.3"
          />
          <rect x="23.5" y="16" width="2.2" height="2.2" fill={spec.accentColor} />
        </g>
      )}

      {spec.id === 'sol' && (
        <g>
          {/* Phoenix Brow Guard & Solar Eyes */}
          <polygon points="16,13 30,15 24,18" fill={spec.secondaryColor} />
          <rect x="23" y="16" width="4.5" height="2.2" fill="#ffffff" />
        </g>
      )}

      {spec.id === 'nyx' && (
        <g>
          {/* Empress Crescent Horns & Forehead Star Gem */}
          <path
            d="M18 11 Q14 4 19 3 M25 11 Q29 4 25 3"
            fill="none"
            stroke={spec.secondaryColor}
            strokeWidth="1.8"
          />
          <rect x="23" y="11.5" width="2.5" height="2.5" fill="#ffffff" />
          <rect x="22" y="16" width="5" height="2.4" fill={spec.accentColor} />
          <rect x="24.5" y="16" width="2" height="2" fill={spec.secondaryColor} />
        </g>
      )}

      {spec.id === 'jin' && (
        <g>
          {/* Cyber-Kitsune Ears, High Collar & Triple-Slit Visor */}
          <polygon points="16,11 13,3 20,10 25,3 27,11" fill="#1e1b4b" />
          <rect
            x="14.5"
            y="19"
            width="15"
            height="6"
            fill="#0f172a"
            stroke={spec.accentColor}
            strokeWidth="1.2"
          />
          <rect x="22" y="14.5" width="6" height="1.4" fill={spec.secondaryColor} />
          <rect x="23" y="16.8" width="5" height="1.4" fill={spec.secondaryColor} />
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
