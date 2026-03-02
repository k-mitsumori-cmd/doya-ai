import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyzeSite } from '@/lib/opening/site-analyzer'
import { generateAnimations } from '@/lib/opening/animation-engine'
import { TEMPLATES } from '@/lib/opening/templates'
import { sendErrorNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id || null
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 })
    }

    // Create project
    const project = await prisma.openingProject.create({
      data: {
        userId,
        guestId: userId ? null : `guest_${Date.now()}`,
        inputUrl: url,
        status: 'ANALYZING',
      },
    })

    // Async: analyze and generate (don't await for faster response)
    analyzeAndGenerate(project.id, url).catch(console.error)

    return NextResponse.json({ success: true, projectId: project.id })
  } catch (error: any) {
    console.error('Opening analyze error:', error)
    sendErrorNotification({
      errorMessage: error?.message || 'Opening analyze failed',
      errorStack: error?.stack,
      pathname: '/api/opening/analyze',
      requestMethod: 'POST',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function analyzeAndGenerate(projectId: string, url: string) {
  try {
    // Analyze site
    const analysis = await analyzeSite(url)

    // Update project with analysis
    await prisma.openingProject.update({
      where: { id: projectId },
      data: { siteAnalysis: analysis as any },
    })

    // Generate animations
    const animations = await generateAnimations(analysis)

    // Save animations to DB
    for (const anim of animations) {
      await prisma.openingAnimation.create({
        data: {
          projectId,
          templateId: anim.templateId,
          config: anim.config as any,
          metadata: {
            name: anim.name,
            nameEn: anim.nameEn,
            description: anim.description,
            category: anim.category,
            isPro: anim.isPro,
          },
        },
      })
    }

    // Update status
    await prisma.openingProject.update({
      where: { id: projectId },
      data: { status: 'READY' },
    })
  } catch (error: any) {
    console.error('analyzeAndGenerate error:', error)
    sendErrorNotification({
      errorMessage: `Opening animation generation failed for ${url}: ${error?.message}`,
      errorStack: error?.stack,
      pathname: `/api/opening/analyze (background: ${projectId})`,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    await prisma.openingProject.update({
      where: { id: projectId },
      data: { status: 'ERROR' },
    }).catch(() => {})
  }
}
