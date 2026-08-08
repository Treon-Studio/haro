/**
 * Safety Guardrail Test — Gateway-level risk detection via regexMatch plugin.
 *
 * This test validates that the existing `default.regexMatch` plugin can be used
 * as a safety guardrail for the mental-wellness assistant by detecting crisis
 * keywords in the assistant's response text.
 *
 * ## Config Preset Attachment
 *
 * The guardrail is attached at the config preset level (not per-request) via
 * the `haro-assistant-default` config's `defaultOutputGuardrails` array. Every
 * request through that config automatically runs the check:
 *
 * ```json
 * {
 *   "strategy": { "mode": "fallback" },
 *   "targets": [...],
 *   "defaultOutputGuardrails": [
 *     {
 *       "id": "default.regexMatch",
 *       "parameters": {
 *         "rule": "(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)",
 *         "flags": "i"
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * This attaches the guardrail at the config level (not per-request), so every
 * request through this config automatically runs the check via the gateway's
 * hook system (see `src/middlewares/hooks/index.ts`).
 */

import { handler as regexMatchHandler } from './regexMatch';
import { PluginContext, PluginParameters } from '../types';

describe('Safety Guardrail — regexMatch plugin (crisis detection)', () => {
  const mockEventType: 'afterRequestHook' = 'afterRequestHook';

  /**
   * Build a mock PluginContext for afterRequestHook with chatComplete response.
   * The getText() utility reads from context.response.json.choices[0].message.content.
   */
  function makeContext(text: string): PluginContext {
    return {
      requestType: 'chatComplete',
      response: {
        json: {
          choices: [
            {
              message: {
                content: text,
              },
            },
          ],
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Suicidal ideation keywords (Indonesian/Malay)
  // ---------------------------------------------------------------------------

  it('should detect "bunuh diri" in response text', async () => {
    const context = makeContext('Saya rasa saya ingin bunuh diri. Semua terasa gelap.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('bunuh diri');
  });

  it('should detect case-insensitive crisis keywords', async () => {
    const context = makeContext('Dia ingin Bunuh Diri karena depresi.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('Bunuh Diri');
  });

  it('should detect "ingin mati" in response text', async () => {
    const context = makeContext('Saya sudah tidak kuat lagi. Saya ingin mati saja.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('ingin mati');
  });

  it('should detect "gak tahan" (variations) in response text', async () => {
    const context = makeContext('Aku gak tahan lagi dengan semua ini.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('gak tahan');
  });

  it('should detect "akhiri hidup" in response text', async () => {
    const context = makeContext('Dia ingin mengakhiri hidupnya karena depresi berat.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('akhiri hidup');
  });

  it('should detect "menyakiti diri" in response text', async () => {
    const context = makeContext('Dia terus menyakiti dirinya sendiri tanpa henti.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('menyakiti diri');
  });

  it('should detect English crisis keywords ("suicide")', async () => {
    const context = makeContext('I am thinking about suicide and I need help.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('suicide');
  });

  it('should detect "killing myself" in response text', async () => {
    const context = makeContext('I feel like killing myself tonight.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('killing myself');
  });

  it('should detect "end my life" in response text', async () => {
    const context = makeContext('I just want to end my life. Nothing matters anymore.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('end my life');
  });

  it('should detect "want to die" in response text', async () => {
    const context = makeContext('I want to die. There is no hope left.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('want to die');
  });

  it('should detect "self-harm" in response text', async () => {
    const context = makeContext('I have been engaging in self-harm behaviors recently.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('self-harm');
  });

  it('should detect "self harm" (without hyphen) in response text', async () => {
    const context = makeContext('I have been engaging in self harm behaviors recently.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(true);
    expect(result.data.matchDetails.matchedText).toBe('self harm');
  });

  // ---------------------------------------------------------------------------
  // Non-matching text — should return verdict: false
  // ---------------------------------------------------------------------------

  it('should NOT flag benign mental-wellness content', async () => {
    const context = makeContext('Merasa cemas itu normal. Coba tarik napas dalam-dalam dan bicara dengan teman.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(false);
    expect(result.data.matchDetails).toBeNull();
  });

  it('should NOT flag general emotional support content', async () => {
    const context = makeContext('Kamu hebat sudah bertahan sejauh ini. Jangan menyerah!');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(false);
    expect(result.data.matchDetails).toBeNull();
  });

  it('should NOT flag English positive affirmation content', async () => {
    const context = makeContext('You are strong and capable. Keep going, things will get better.');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.verdict).toBe(false);
    expect(result.data.matchDetails).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('should handle empty response text gracefully', async () => {
    const context = makeContext('');
    const parameters: PluginParameters = {
      rule: '(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)',
      flags: 'i',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.error).not.toBeNull();
    expect(result.verdict).toBe(false);
  });

  it('should handle invalid regex pattern gracefully', async () => {
    const context = makeContext('Some text here.');
    const parameters: PluginParameters = {
      rule: '(',
      not: false,
    };
    const result = await regexMatchHandler(context, parameters, mockEventType);
    expect(result.error).not.toBeNull();
    expect(result.verdict).toBe(false);
  });
});
