exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    let messages = body.messages;
    let finalResponse;

    // Agentic loop — keep calling until we get a final text response
    for (let i = 0; i < 10; i++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05'
        },
        body: JSON.stringify({ ...body, messages })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        };
      }

      // If stop_reason is end_turn or no tool_use blocks, we're done
      const hasToolUse = data.content.some(b => b.type === 'tool_use');
      if (!hasToolUse || data.stop_reason === 'end_turn') {
        finalResponse = data;
        break;
      }

      // Append assistant response and tool results to messages
      messages = [
        ...messages,
        { role: 'assistant', content: data.content },
        {
          role: 'user',
          content: data.content
            .filter(b => b.type === 'tool_use')
            .map(b => ({
              type: 'tool_result',
              tool_use_id: b.id,
              content: b.input?.query ? `Search completed for: ${b.input.query}` : 'Search completed'
            }))
        }
      ];
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalResponse)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};