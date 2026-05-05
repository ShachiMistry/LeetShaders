import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { supabase } from './supabase.js';

// Load environment variables from .env or .env.local
dotenv.config({ path: '.env.local' });
dotenv.config();

const CHALLENGES_DIR = './src/challenges';

async function seed() {
  console.log('🚀 Starting challenge seed process...');

  try {
    const files = fs.readdirSync(CHALLENGES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const jsonFile of jsonFiles) {
      const slug = jsonFile.replace('.json', '');
      const jsonPath = path.join(CHALLENGES_DIR, jsonFile);
      const glslPath = path.join(CHALLENGES_DIR, `${slug}.glsl`);

      if (!fs.existsSync(glslPath)) {
        console.warn(`⚠️  Warning: No matching .glsl file found for ${slug}. Skipping.`);
        continue;
      }

      const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const shaderSrc = fs.readFileSync(glslPath, 'utf-8');

      console.log(`📦 Seeding challenge: ${metadata.title} (${slug})...`);

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
          credit: metadata.credit
        }, {
          onConflict: 'slug'
        });

      if (error) {
        console.error(`❌ Error seeding ${slug}:`, error.message);
      } else {
        console.log(`✅ Successfully seeded ${slug}`);
      }
    }

    console.log('\n✨ Seeding complete!');
  } catch (err) {
    console.error('💥 Fatal error during seeding:', err);
    process.exit(1);
  }
}

seed();
