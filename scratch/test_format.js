const val = 4800;
console.log('es-ES:', val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }));
console.log('de-DE:', val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }));
console.log('en-US:', val.toLocaleString('en-US', { style: 'currency', currency: 'EUR' }));
console.log('it-IT:', val.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
