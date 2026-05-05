import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CHALLENGES_DIR = './src/challenges';

async function seed() {
  console.log('Starting challenge seed process...');

  try {
    const files = fs.readdirSync(CHALLENGES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const jsonFile of jsonFiles) {
      const slug = jsonFile.replace('.json', '');
      const jsonPath = path.join(CHALLENGES_DIR, jsonFile);
      const glslPath = path.join(CHALLENGES_DIR, `${slug}.glsl`);

      if (!fs.existsSync(glslPath)) {
        console.warn(`Warning: No matching .glsl file found for ${slug}. Skipping.`);
        continue;
      }

      const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const shaderSrc = fs.readFileSync(glslPath, 'utf-8');

      console.log(`Seeding challenge: ${metadata.title} (${slug})...`);

      const { error } = await supabase
        .from('challenges')
        .upsert({
          id: metadata.id,
          slug: metadata.slug,
          title: metadata.title,
          description: metadata.description,
          difficulty: metadata.difficulty,
          reference_shader_src: shaderSrc,
          tolerance: metadata.tolerance,
          use_blur: metadata.useBlur,
          hint_text: metadata.hintText,
        }, {
          onConflict: 'slug'
        });

      if (error) {
        console.error(`Error seeding ${slug}:`, error.message);
      } else {
        console.log(`Seeded ${slug}`);
      }
    }

    console.log('\nSeeding complete!');
  } catch (err) {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
  }
}

seed();
