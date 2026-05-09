import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get('pageType');
    const pageId = searchParams.get('pageId');

    if (pageType && pageId) {
      const result = await query(`
        SELECT * FROM seo_metadata
        WHERE page_type = ? AND page_id = ?
      `, [pageType, pageId]);
      const rows = result.rows as Array<Record<string, unknown>>;
      if (rows.length > 0) {
        return NextResponse.json({ seo: rows[0] });
      }
      const presetResult = await query(`
        SELECT * FROM seo_presets
        WHERE page_type = ? AND is_default = true
        LIMIT 1
      `, [pageType]);
      const presets = presetResult.rows as Array<Record<string, unknown>>;
      return NextResponse.json({ seo: null, preset: presets[0] || null });
    }

    const result = await query(`SELECT * FROM seo_metadata ORDER BY page_type, page_id`);
    const presetsResult = await query(`SELECT * FROM seo_presets ORDER BY page_type, is_default DESC`);
    return NextResponse.json({ seoEntries: result.rows, presets: presetsResult.rows });
  } catch (error) {
    console.error('[Admin API] Failed to get SEO:', error);
    return NextResponse.json({ error: 'Failed to get SEO data', seoEntries: [], presets: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageType, pageId, title, description, ogImage, keywords, canonicalUrl, noIndex, structuredData } = body;

    if (!pageType) {
      return NextResponse.json({ error: 'pageType is required' }, { status: 400 });
    }

    await query(`
      INSERT INTO seo_metadata (
        page_type, page_id, title, description, og_image,
        keywords, canonical_url, no_index, structured_data
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        og_image = VALUES(og_image),
        keywords = VALUES(keywords),
        canonical_url = VALUES(canonical_url),
        no_index = VALUES(no_index),
        structured_data = VALUES(structured_data)
    `, [
      pageType, pageId || null, title || null, description || null,
      ogImage || null, keywords || null, canonicalUrl || null,
      noIndex || false, structuredData ? JSON.stringify(structuredData) : null
    ]);

    return NextResponse.json({ success: true, message: 'SEO metadata saved successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to save SEO:', error);
    return NextResponse.json({ error: 'Failed to save SEO metadata' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, titleTemplate, descriptionTemplate, keywordsTemplate, isDefault } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await query(`
      UPDATE seo_presets
      SET title_template = ?, description_template = ?, keywords_template = ?, is_default = ?
      WHERE id = ?
    `, [titleTemplate || null, descriptionTemplate || null, keywordsTemplate || null, isDefault || false, id]);

    return NextResponse.json({ success: true, message: 'SEO preset updated successfully' });
  } catch (error) {
    console.error('[Admin API] Failed to update SEO preset:', error);
    return NextResponse.json({ error: 'Failed to update SEO preset' }, { status: 500 });
  }
}
