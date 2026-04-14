import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUser() {
  const email = 'admin@docuflow.com';
  const password = 'Password123!';
  const name = 'Administrador';

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
    console.error('Error al crear usuario:', error.message);
  } else {
    console.log('Usuario creado exitosamente.');
    console.log('Email:', email);
    console.log('Contraseña:', password);
  }
}

createUser();
