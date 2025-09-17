import { GoogleGenAI } from '@google/genai';

interface InsightData {
  productionMetrics: {
    totalProduction: number;
    avgErrorRate: number;
    avgTimeTaken: number;
    efficiency: number;
  };
  workerMetrics: Array<{
    worker: { id: number; name: string; role: string|null };
    totalProduction: number;
    avgErrorRate: number;
    avgTimeTaken: number;
    recordCount: number; 
    performanceScore: number;
  }>;
  productionLineMetrics: Array<{
    productionLine: { id: number; name: string; targetOutput: number|null };
    totalProduction: number;
    efficiency: number;
    avgErrorRate: number;
    avgTimeTaken: number;
    recordCount: number; 
  }>;
  trends: Array<{
    date: string;
    production: number;
    errorRate: number;
    timeTaken: number;
  }>;
}

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async generateInsights(data: InsightData): Promise<{
    summary: string;
    recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      impact: string;
    }>;
    alerts: Array<{
      type: 'warning' | 'critical' | 'info';
      message: string;
      action: string;
    }>;
    kpis: {
      overallEfficiency: number;
      qualityScore: number;
      productivityTrend: 'improving' | 'declining' | 'stable';
      riskLevel: 'low' | 'medium' | 'high';
    };
  }> {
    const prompt = this.buildAnalysisPrompt(data);
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          maxOutputTokens: 4096,
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
        }
      });
      
      return this.parseGeminiResponse(response.text, data);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error('Failed to generate AI insights');
    }
  }

  private buildAnalysisPrompt(data: InsightData): string {
    return `
You are an AI manufacturing consultant analyzing production data. Provide actionable insights in JSON format.

PRODUCTION DATA:
- Total Production: ${data.productionMetrics.totalProduction} pieces
- Average Error Rate: ${data.productionMetrics.avgErrorRate}%
- Average Time Taken: ${data.productionMetrics.avgTimeTaken} hours
- Overall Efficiency: ${data.productionMetrics.efficiency}%

WORKER PERFORMANCE (Top 5):
${data.workerMetrics.slice(0, 5).map(w => 
  `- ${w.worker.name} (${w.worker.role || 'Worker'}): ${w.totalProduction} pieces, ${w.avgErrorRate}% error rate`
).join('\n')}

PRODUCTION LINE PERFORMANCE:
${data.productionLineMetrics.map(pl => 
  `- ${pl.productionLine.name}: ${pl.totalProduction} pieces, ${pl.efficiency}% efficiency, ${pl.avgErrorRate}% error rate`
).join('\n')}

RECENT TRENDS (Last 7 days):
${data.trends.map(t => `${t.date}: ${t.production} pieces, ${t.errorRate}% errors`).join('\n')}
Analyze this data and respond ONLY with valid JSON in this exact structure:
{
  "summary": "Brief 2-3 sentence overview of overall performance",
  "recommendations": [
    {
      "category": "productivity|quality|efficiency|workforce|maintenance",
      "priority": "high|medium|low",
      "title": "Short recommendation title",
      "description": "Detailed description of what to do",
      "impact": "Expected positive impact"
    }
  ],
  "alerts": [
    {
      "type": "warning|critical|info",
      "message": "Alert description",
      "action": "Recommended immediate action"
    }
  ],
  "kpis": {
    "overallEfficiency": 85.2,
    "qualityScore": 92.1,
    "productivityTrend": "improving|declining|stable",
    "riskLevel": "low|medium|high"
  }
}

Focus on:
1. Identifying production bottlenecks
2. Quality improvement opportunities  
3. Worker performance patterns
4. Resource optimization
5. Predictive maintenance needs
6. Scheduling efficiency

Provide 3-5 actionable recommendations and 0-3 alerts if issues found.
    `;
  }

  private parseGeminiResponse(text: string, data: InsightData): any {
    try {
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and ensure required structure
      return {
        summary: parsed.summary || 'No summary available',
        recommendations: parsed.recommendations || [],
        alerts: parsed.alerts || [],
        kpis: {
          overallEfficiency: parsed.kpis?.overallEfficiency || 0,
          qualityScore: parsed.kpis?.qualityScore || 0,
          productivityTrend: parsed.kpis?.productivityTrend || 'stable',
          riskLevel: parsed.kpis?.riskLevel || 'medium'
        }
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      // Fallback response
      return this.generateFallbackInsights(data);
    }
  }

  private generateFallbackInsights(data: InsightData) {
    const avgErrorRate = data.productionMetrics.avgErrorRate;
    const totalProduction = data.productionMetrics.totalProduction;
    
    return {
      summary: `Production analysis shows ${totalProduction} pieces produced with ${avgErrorRate.toFixed(1)}% error rate. ${avgErrorRate > 5 ? 'Quality improvements needed.' : 'Quality within acceptable range.'}`,
      recommendations: [
        {
          category: 'quality',
          priority: avgErrorRate > 10 ? 'high' : 'medium',
          title: 'Monitor Error Rates',
          description: `Current error rate is ${avgErrorRate.toFixed(1)}%. ${avgErrorRate > 5 ? 'Focus on quality control measures.' : 'Maintain current quality standards.'}`,
          impact: 'Improved product quality and reduced waste'
        }
      ],
      alerts: avgErrorRate > 10 ? [
        {
          type: 'warning' as const,
          message: 'High error rate detected',
          action: 'Review quality control processes immediately'
        }
      ] : [],
      kpis: {
        overallEfficiency: Math.max(0, 100 - avgErrorRate),
        qualityScore: Math.max(0, 100 - avgErrorRate),
        productivityTrend: 'stable' as const,
        riskLevel: avgErrorRate > 10 ? 'high' as const : avgErrorRate > 5 ? 'medium' as const : 'low' as const
      }
    };
  }
}

export default GeminiService;