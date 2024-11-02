const express = require('express');
const app = express();
const { connectDB, createUserCollection } = require('./db');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');
const secretKey = 'prueba-tecnica-junior';
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');
const ejs = require('ejs');

// Establecer la ruta de las vistas
const viewsDir = path.join(__dirname, '..', 'views');
app.set('views', viewsDir);
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Middleware de autenticación
const authMiddleware = async (req, res, next) => {
  const authorization = req.headers.authorization || req.cookies.token;
  if (!authorization) {
    return res.redirect('/inicio');
  }
  const token = authorization.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, secretKey);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.redirect('/inicio');
  }
};


// INDEX DE USUARIO
app.get('/index', async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/inicio');
  }
  res.sendFile(path.join(__dirname, '../views/index.html'));
});


// RUTA DE INICIO
app.get('/inicio', async (req, res) => {
  const token = req.cookies.token;
  if (token) {
    res.redirect('/index');
  } else {
    res.sendFile(path.join(__dirname, '../views/inicio.html'));
  }
});


// RUTA DE REGISTRARSE
app.get('/registro', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/register.html'));
});


// CONEXION BASE DE DATOS
connectDB().then(async (db) => {
  const userCollection = await createUserCollection(db);
  const taskCollection = db.collection('tasks');

  // FUNCIONALIDA REGISTRARSE
  app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("CAMPOS OBLIGATORIOS");
    }

    if (password.length < 2) {
      return res.status(400).send("CONTRASEÑA DEMASIADO CORTA");
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 12);
      await userCollection.insertOne({ email, password: hashedPassword });
      res.send("USUARIO CREADO CON EXITO");
    } catch (err) {
      console.log(err);
      if (err.code === 11000) {
        res.status(400).send("CORREO ELECTRÓNICO YA EXISTE");
      } else {
        res.status(400).send("ERROR AL REGISTRAR USUARIO");
      }
    }
  });


  // FUNCIONALIDAD LOGIN
  app.post('/login', async (req, res) => {
    console.log('Petición de login:', req.body);
    try {
      const user = await userCollection.findOne({ email: req.body.email });
      console.log('Usuario encontrado:', user);
      if (!user) {
        console.log('Error: Usuario no encontrado');
        res.status(401).send("CORREO O CONTRASEÑA INCORRECTOS");
      } else if (!(await bcrypt.compare(req.body.password, user.password))) {
        console.log('Error: Contraseña incorrecta');
        res.status(401).send("CORREO O CONTRASEÑA INCORRECTO");
      } else {
        const token = jwt.sign({ userId: user._id }, secretKey, {
          expiresIn: '1h',
        });
        console.log('Token generado:', token);
  
        res.cookie('token', token, { httpOnly: false, secure: true });
        res.header('Authorization', `Bearer ${token}`); 
  
        res.json({ token, email: user.email });
      }
    } catch (err) {
      console.log('Error de servidor:', err);
      res.status(500).send("ERROR INTERNO");
    }
  });


  // RUTA DE EDITAR PERFIL
  app.get('/editProfile', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/editProfile.html'));
  });


  // FUNCIONALIDAD DE EDITAR PERFIL
  app.patch('/editProfile', authMiddleware, async (req, res) => {
    const id = req.userId;
    const { correo, contrasenaActual, nuevaContrasena, confirmarContrasena } = req.body;
    try {
      const user = await userCollection.findOne({ _id: new ObjectId(id) });
      if (!user) {
        return res.status(404).send('Usuario no encontrado');
      }
      if (!(await bcrypt.compare(contrasenaActual, user.password))) {
        return res.status(401).send('Contraseña actual incorrecta');
      }
      if (nuevaContrasena !== confirmarContrasena) {
        return res.status(400).send('Contraseña nueva no coincide');
      }
      const hashedPassword = await bcrypt.hash(nuevaContrasena, 12);
      await userCollection.updateOne({ _id: new ObjectId(id) }, { $set: { email: correo, password: hashedPassword } });
      res.clearCookie('token');
      const token = jwt.sign({ userId: user._id }, secretKey, {
        expiresIn: '1h',
      });
      res.cookie('token', token, { httpOnly: false, secure: true });
      res.json({ mensaje: 'Perfil actualizado con éxito' });
    } catch (err) {
      console.error(err);
      res.status(400).send('Error al actualizar perfil');
    }
  });


  // VERIFICAR CONTRASEÑA
  app.post('/verifyPassword', authMiddleware, async (req, res) => {
    const { correo, contrasenaActual } = req.body;
    try {
      const user = await userCollection.findOne({ email: correo });
      if (!user) {
        return res.status(404).send({ mensaje: 'Usuario no encontrado' });
      }
      const esContrasenaCorrecta = await bcrypt.compare(contrasenaActual, user.password);
      if (!esContrasenaCorrecta) {
        return res.status(401).send({ mensaje: 'Contraseña actual incorrecta' });
      }
      res.json({ mensaje: 'Contraseña correcta' });
    } catch (err) {
      console.error(err);
      res.status(400).send({ mensaje: 'Error al verificar contraseña' });
    }
  });


  // CERRAR CESION
  app.get('/logout', async (req, res) => {
    res.clearCookie('token', { httpOnly: false, secure: true });
    res.redirect('http://localhost:3001/inicio');
  });

  
  // PROTECCION 
  app.get('/protected', authMiddleware, async (req, res) => {
    console.log('ID de usuario:', req.userId);
    try {
      const ObjectId = require('mongodb').ObjectId;
      const correo = await userCollection.findOne({ _id: new ObjectId(req.userId) }, { projection: { email: 1 } });
      console.log('Correo encontrado:', correo);
      if (!correo) {
        return res.status(404).json({ message: 'Correo no encontrado' });
      }
      res.json({ email: correo.email });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error interno' });
    }
  });


  // CRUD de tareas
  // INDEX GESTION DE TAREAS
  app.get('/gestionTareas', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/gestionTareas.html'));
  });


  // RUTA DE CREAR TAREAS
  app.get('/crearTarea', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/createTarea.html'));
  });


  // CREAR TAREAS
  app.post('/tasks', authMiddleware, async (req, res) => {
    const { title, description } = req.body;
    try {
      await taskCollection.insertOne({ title, description, completed: false, userId: req.userId });
      res.status(201).send({ mensaje: 'Tarea creada con éxito' }); 
    } catch (err) {
      console.error(err);
      res.status(400).send({ mensaje: 'Error al crear tarea' });
    }
  });


  // RUTA DE LISTAR TAREAS
  app.get('/listaTareas', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/listTareas.html'));
  });


  // LISTAR TAREAS
  app.get('/listTasks', authMiddleware, async (req, res) => {
    try {
      const tasks = await taskCollection.find({ userId: req.userId }).toArray();
      res.json(tasks);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error interno');
    }
  });


  // RUTA EDITAR TAREA
  app.get('/editarTarea/:id', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/editTarea.html'));
  });
  

  // OBTENER TAREA
  app.get('/editarTarea/:id/data', authMiddleware, async (req, res) => {
    const id = req.params.id;
    try {
      const tarea = await taskCollection.findOne({ _id: new ObjectId(id), userId: req.userId });
      if (!tarea) {
        return res.status(404).send({ mensaje: 'Tarea no encontrada' });
      }
      res.json(tarea);
    } catch (err) {
      console.error(err);
      res.status(400).send('Error al obtener tarea');
    }
  });
  

  // EDITAR TAREA
  app.patch('/editarTarea/:id', async (req, res) => {
    const id = req.params.id;
    const { titulo, descripcion, estado } = req.body;
    try {
      const tarea = await taskCollection.findOne({ _id: new ObjectId(id) });
      if (!tarea) {
        return res.status(404).send('Tarea no encontrada');
      }
      await taskCollection.updateOne({ _id: new ObjectId(id) }, { 
        $set: { 
          title: titulo, 
          description: descripcion, 
          completed: estado === 'completada' 
        } 
      });
      res.json({ mensaje: 'Tarea actualizada con éxito' });
    } catch (err) {
      console.error(err);
      res.status(400).send('Error al actualizar tarea');
    }
  });
  

  // COMPELTAR TAREA
  app.patch('/completarTarea/:id', async (req, res) => {
    const id = req.params.id;
    const { completed } = req.body;
    try {
      const tarea = await taskCollection.findOne({ _id: new ObjectId(id) });
      if (!tarea) {
        return res.status(404).send('Tarea no encontrada');
      }
      await taskCollection.updateOne({ _id: new ObjectId(id) }, { $set: { completed } });
      res.json({ mensaje: 'Tarea actualizada con éxito' });
    } catch (err) {
      console.error(err);
      res.status(400).send('Error al actualizar tarea');
    }
  });


  // ELIMINAR TAREA
  app.delete('/tasks/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    try {
      await taskCollection.deleteOne({ _id: new ObjectId(id), userId: req.userId });
      res.send('Tarea eliminada con éxito');
    } catch (err) {
      console.error(err);
      res.status(400).send('Error al eliminar tarea');
    }
  });

}).catch((err) => {
  console.error('Error conectando a la base de datos:', err);
});

app.listen(3001, () => {
  console.log('Servidor escuchando en puerto 3001');
});