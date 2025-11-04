import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler, requireAuth } from '@/lib/server-utils';
import { validateRequestBody } from '@/lib/utils';
import {
  createScaffoldingField,
  getScaffoldingFields,
} from '@/lib/scaffolding-service';

const scaffoldingFieldSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  fieldType: z.enum(['numeric', 'text', 'percentage', 'currency']).default('numeric'),
});

/**
 * GET /api/scaffolding/fields
 * Get all scaffolding field definitions
 */
export const GET = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const fields = await getScaffoldingFields(activeOnly);

    return NextResponse.json({
      success: true,
      data: fields,
      meta: {
        count: fields.length,
        timestamp: new Date().toISOString(),
      },
    });
  },
  {
    requireAuth: true,
    rateLimit: { limit: 100, windowMs: 60000 },
    allowedMethods: ['GET'],
  }
);

/**
 * POST /api/scaffolding/fields
 * Create a new scaffolding field definition
 */
export const POST = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request);
    const validatedData = await validateRequestBody(scaffoldingFieldSchema)(request);

    const field = await createScaffoldingField({
      name: validatedData.name,
      description: validatedData.description,
      fieldType: validatedData.fieldType,
      createdBy: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: field,
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  },
  {
    requireAuth: true,
    rateLimit: { limit: 20, windowMs: 60000 },
    allowedMethods: ['POST'],
  }
);
