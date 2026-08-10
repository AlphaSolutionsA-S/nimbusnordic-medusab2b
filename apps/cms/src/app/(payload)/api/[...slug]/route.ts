import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return new Response('Payload API - GET', { status: 200 });
}

export async function POST(request: NextRequest) {
  return new Response('Payload API - POST', { status: 200 });
}

export async function PATCH(request: NextRequest) {
  return new Response('Payload API - PATCH', { status: 200 });
}

export async function DELETE(request: NextRequest) {
  return new Response('Payload API - DELETE', { status: 200 });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204 });
}
