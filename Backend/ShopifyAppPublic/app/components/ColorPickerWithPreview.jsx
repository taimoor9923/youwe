import React, { useState, useCallback, useEffect } from 'react';
import { ColorPicker, Popover, TextField } from '@shopify/polaris';

const hslToRgb = (h, s, l) => {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: break;
    }
    h /= 6;
  }

  return {
    hue: h * 360,
    saturation: s,
    brightness: l
  };
};

const colorToHex = (color) => {
  const [r, g, b] = hslToRgb(color.hue / 360, color.saturation, color.brightness);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
};

const hexToColor = (hex) => {
  if (!/^#[0-9A-F]{6}$/i.test(hex)) return null;
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return rgbToHsl(r, g, b);
};

export const ColorPickerWithPreview = ({ label, color, onChange }) => {
  const [pickerActive, setPickerActive] = useState(false);
  const [tempColor, setTempColor] = useState(hexToColor(color));
  const [hexValue, setHexValue] = useState(color);

  const handleClick = useCallback(() => {
    setTempColor(hexToColor(color));
    setPickerActive(!pickerActive);
    setHexValue(color);
  }, [color, pickerActive]);

  useEffect(() => {
    setHexValue(color);
  }, [color]);

  const handleTempColorChange = useCallback((newColor) => {
     const newHex = colorToHex(newColor);
    setTempColor(newColor);
    setHexValue(newHex);
    onChange(newHex);
  }, [onChange]);

  const handleHexValueChange = useCallback((value) => {

    setHexValue(value);
    const newColor = hexToColor(value);
    if (newColor) {
      setTempColor(newColor);
      onChange(value);
    }
  }, [onChange]);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div onClick={handleClick} style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: hexValue,
        marginRight: '8px',
        border: '1px solid #ccc',
        cursor: 'pointer'
      }}></div>
      <div>
        <Popover active={pickerActive} activator={<div style={{ cursor: 'pointer' }} onClick={handleClick}>{label}</div>} onClose={() => setPickerActive(false)}>
          <div style={{ padding: '16px' }}>
            <ColorPicker color={tempColor} onChange={handleTempColorChange} />
            <div style={{ marginTop: '16px' }}>
              <TextField label="Hex Value" value={hexValue} onChange={handleHexValueChange} />
            </div>
          </div>
        </Popover>
        <div style={{ color: '#5c5f62', fontSize: '0.875rem' }}>
          {hexValue}
        </div>
      </div>
    </div>
  );
};
