const axios = require('axios');

const token = document.cookie.match(/token=([^;]*)/)[1];

axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

axios.get('http://localhost:3001/protected')
  .then(response => {
    const email = response.data.email;
    console.log('Correo electrónico:', email); // Verifica que se esté recibiendo el correo electrónico correcto
    document.getElementById('correo').innerHTML = `Bienvenido, <strong>${email}</strong>`;
  })
  .catch(error => {
    console.log(error);
  });