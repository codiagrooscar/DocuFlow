import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'codiagrooscar@gmail.com';
  const password = '123456';
  const name = 'Admin Oscar';

  console.log(`Creando usuario ${email}...`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      }
    }
  });

  if (error) {
    console.error('Error al crear usuario en Auth:', error.message);
    if (!error.message.includes("already registered")) {
        return;
    }
  }

  // Si ya existía o se creó bien, obtenemos el ID real a la fuerza por si acaso
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
      console.error('No se pudo iniciar sesión para obtener el UID', signInError.message);
      return;
  }

  const userId = signInData.user.id;

  console.log('Insertando role "admin" en public.users para el ID:', userId);

  const { error: dbError } = await supabase.from('users').upsert({
    uid: userId,
    email: email,
    displayName: name,
    role: 'admin'
  });

  if (dbError) {
    console.error('Error al asignar rol de administrador:', dbError.message);
  } else {
    console.log('Usuario de administrador creado e insertado en public.users con éxito.');
  }
}

createAdmin();
