/**
 * Google Slides Output Generator
 * 
 * Generates Google Slides presentations from parsed markdown content with rendered diagrams
 */

import { google, slides_v1 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import {
  OutputGenerator,
  ParsedContent,
  RenderedDiagram,
  ConversionOutput,
  ConversionError
} from '../types';

export interface GoogleSlidesOptions {
  title?: string;
  theme?: 'simple' | 'modern' | 'focus' | 'shift' | 'momentum' | 'paradigm';
  layoutPreference?: 'title_and_body' | 'title_only' | 'blank';
  shareWithEmails?: string[];
  folderId?: string; // Google Drive folder ID
  makePublic?: boolean;
}

export interface SlideContent {
  type: 'title' | 'section' | 'content' | 'diagram' | 'code';
  title?: string;
  subtitle?: string;
  content?: string[];
  diagram?: RenderedDiagram;
  codeLanguage?: string;
}

export interface GoogleSlidesResult {
  presentationId: string;
  presentationUrl: string;
  editUrl: string;
  shareUrl?: string | undefined;
  slideCount: number;
  title: string;
}

export class GoogleSlidesGenerator implements OutputGenerator {
  format = 'google-slides';
  name = 'Google Slides Generator';
  description = 'Generate Google Slides presentations with embedded diagrams';

  private auth: GoogleAuth;
  private slides: slides_v1.Slides;

  constructor(authOptions?: any) {
    this.auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive.file'
      ],
      ...authOptions
    });
    
    this.slides = google.slides({ version: 'v1', auth: this.auth });
  }

  optionsSchema = {
    title: { type: 'string', default: 'Generated Presentation' },
    theme: { 
      type: 'string', 
      enum: ['simple', 'modern', 'focus', 'shift', 'momentum', 'paradigm'], 
      default: 'modern' 
    },
    layoutPreference: {
      type: 'string',
      enum: ['title_and_body', 'title_only', 'blank'],
      default: 'title_and_body'
    },
    shareWithEmails: { type: 'array', items: { type: 'string' } },
    folderId: { type: 'string' },
    makePublic: { type: 'boolean', default: false }
  };

  async generate(
    content: ParsedContent,
    diagrams: RenderedDiagram[],
    options: GoogleSlidesOptions = {}
  ): Promise<ConversionOutput> {
    try {
      // Map content to slides
      const slideContents = this.mapContentToSlides(content, diagrams);
      
      // Create presentation
      const presentation = await this.createPresentation(
        options.title || content.title || 'Generated Presentation'
      );
      
      // Add slides with content
      await this.populateSlides(presentation.presentationId!, slideContents, options);
      
      // Apply theme if specified
      if (options.theme && options.theme !== 'simple') {
        await this.applyTheme(presentation.presentationId!, options.theme);
      }
      
      // Share presentation if requested
      let shareUrl: string | undefined;
      if (options.shareWithEmails?.length || options.makePublic) {
        shareUrl = await this.sharePresentation(
          presentation.presentationId!, 
          options.shareWithEmails, 
          options.makePublic
        );
      }
      
      const result: GoogleSlidesResult = {
        presentationId: presentation.presentationId!,
        presentationUrl: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
        editUrl: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
        shareUrl: shareUrl || undefined,
        slideCount: slideContents.length,
        title: presentation.title!
      };

      return {
        data: Buffer.from(JSON.stringify(result, null, 2)),
        format: this.format,
        mimeType: 'application/json',
        metadata: {
          presentationId: result.presentationId,
          url: result.presentationUrl,
          editUrl: result.editUrl,
          shareUrl: result.shareUrl || undefined,
          slides: result.slideCount,
          processingTime: Date.now()
        }
      };
    } catch (error: any) {
      throw new ConversionError(
        `Failed to create Google Slides presentation: ${error.message}`,
        'SLIDES_GENERATION_FAILED',
        { originalError: error }
      );
    }
  }

  private mapContentToSlides(content: ParsedContent, diagrams: RenderedDiagram[]): SlideContent[] {
    const slides: SlideContent[] = [];
    let diagramIndex = 0;

    // Create title slide
    slides.push({
      type: 'title',
      title: content.title || 'Presentation',
      subtitle: 'Generated from Markdown'
    });

    // Process content sections
    let currentSlide: SlideContent | null = null;

    for (const section of content.sections) {
      switch (section.type) {
        case 'heading':
          if (section.level === 1) {
            // H1 creates a new section slide
            if (currentSlide) slides.push(currentSlide);
            currentSlide = {
              type: 'section',
              title: section.content,
              content: []
            };
          } else if (section.level === 2) {
            // H2 creates a new content slide
            if (currentSlide) slides.push(currentSlide);
            currentSlide = {
              type: 'content',
              title: section.content,
              content: []
            };
          } else {
            // H3+ becomes content
            if (!currentSlide) {
              currentSlide = {
                type: 'content',
                title: section.content,
                content: []
              };
            } else {
              currentSlide.content = currentSlide.content || [];
              currentSlide.content.push(`${'#'.repeat(section.level || 3)} ${section.content}`);
            }
          }
          break;

        case 'paragraph':
          if (!currentSlide) {
            currentSlide = {
              type: 'content',
              title: 'Content',
              content: []
            };
          }
          currentSlide.content = currentSlide.content || [];
          currentSlide.content.push(section.content);
          break;

        case 'list':
          if (!currentSlide) {
            currentSlide = {
              type: 'content',
              title: 'Content',
              content: []
            };
          }
          currentSlide.content = currentSlide.content || [];
          // Parse list items from content
          const items = section.content.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'));
          items.forEach((item: string) => {
            const cleanItem = item.replace(/^[\s\-\*]+/, '').trim();
            currentSlide!.content!.push(`• ${cleanItem}`);
          });
          break;

        case 'code':
          // Code blocks get their own slide
          if (currentSlide) slides.push(currentSlide);
          slides.push({
            type: 'code',
            title: 'Code',
            content: [section.content],
            codeLanguage: 'text' // Could extract language from markdown
          });
          currentSlide = null;
          break;

        case 'diagram':
          // Diagrams get their own slide
          if (currentSlide) slides.push(currentSlide);
          
          const diagram = diagrams[diagramIndex++];
          if (diagram) {
            slides.push({
              type: 'diagram',
              title: diagram.info.title || 'Diagram',
              diagram
            });
          }
          currentSlide = null;
          break;
      }
    }

    // Add final slide if exists
    if (currentSlide) slides.push(currentSlide);

    return slides;
  }

  private async createPresentation(title: string): Promise<slides_v1.Schema$Presentation> {
    const response = await this.slides.presentations.create({
      requestBody: {
        title
      }
    });

    return response.data;
  }

  private async populateSlides(
    presentationId: string, 
    slideContents: SlideContent[], 
    options: GoogleSlidesOptions
  ): Promise<void> {
    const requests: slides_v1.Schema$Request[] = [];

    // Get presentation to find existing slide IDs
    const presentation = await this.slides.presentations.get({
      presentationId
    });

    const existingSlideId = presentation.data.slides?.[0]?.objectId;

    for (let i = 0; i < slideContents.length; i++) {
      const slideContent = slideContents[i];
      let slideId: string;

      if (i === 0 && existingSlideId) {
        // Use existing first slide
        slideId = existingSlideId;
      } else {
        // Create new slide
        slideId = `slide_${i}_${Date.now()}`;
        requests.push({
          createSlide: {
            objectId: slideId,
            slideLayoutReference: {
              predefinedLayout: this.getLayoutForSlideType(slideContent?.type || 'content')
            }
          }
        });
      }

      // Add content to slide
      if (slideContent) {
        requests.push(...this.createSlideContentRequests(slideId, slideContent));
      }
    }

    // Execute all requests in batches
    const batchSize = 25; // Google Slides API limit
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      await this.slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: batch
        }
      });
    }
  }

  private getLayoutForSlideType(type: string): string {
    switch (type) {
      case 'title':
        return 'TITLE';
      case 'section':
        return 'SECTION_HEADER';
      case 'diagram':
      case 'code':
        return 'BLANK';
      default:
        return 'TITLE_AND_BODY';
    }
  }

  private createSlideContentRequests(slideId: string, content: SlideContent): slides_v1.Schema$Request[] {
    const requests: slides_v1.Schema$Request[] = [];

    switch (content.type) {
      case 'title':
        requests.push({
          insertText: {
            objectId: slideId,
            text: content.title || '',
            insertionIndex: 0
          }
        });
        if (content.subtitle) {
          requests.push({
            insertText: {
              objectId: slideId,
              text: content.subtitle,
              insertionIndex: 0
            }
          });
        }
        break;

      case 'section':
      case 'content':
        if (content.title) {
          requests.push({
            insertText: {
              objectId: slideId,
              text: content.title,
              insertionIndex: 0
            }
          });
        }
        if (content.content?.length) {
          const bodyText = content.content.join('\n\n');
          requests.push({
            insertText: {
              objectId: slideId,
              text: bodyText,
              insertionIndex: 0
            }
          });
        }
        break;

      case 'diagram':
        if (content.diagram) {
          // Create image from diagram data
          requests.push({
            createImage: {
              objectId: `image_${slideId}`,
              url: content.diagram.dataUrl,
              elementProperties: {
                pageObjectId: slideId,
                size: {
                  width: { magnitude: 400, unit: 'PT' },
                  height: { magnitude: 300, unit: 'PT' }
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: 50,
                  translateY: 100,
                  unit: 'PT'
                }
              }
            }
          });
          
          if (content.title) {
            requests.push({
              insertText: {
                objectId: slideId,
                text: content.title,
                insertionIndex: 0
              }
            });
          }
        }
        break;

      case 'code':
        if (content.content?.length) {
          const codeText = content.content.join('\n');
          requests.push({
            insertText: {
              objectId: slideId,
              text: codeText,
              insertionIndex: 0
            }
          });
        }
        break;
    }

    return requests;
  }

  private async applyTheme(presentationId: string, theme: string): Promise<void> {
    // Theme application would be implemented here
    // For now, we'll skip theme application as it requires complex API calls
    console.log(`Theme '${theme}' would be applied to presentation ${presentationId}`);
  }

  private async sharePresentation(
    presentationId: string, 
    emails?: string[], 
    makePublic?: boolean
  ): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.auth });

    if (makePublic) {
      await drive.permissions.create({
        fileId: presentationId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
    }

    if (emails?.length) {
      for (const email of emails) {
        await drive.permissions.create({
          fileId: presentationId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: email
          }
        });
      }
    }

    return `https://docs.google.com/presentation/d/${presentationId}/edit?usp=sharing`;
  }
}