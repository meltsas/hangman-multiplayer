import { Room } from './Room';
import { GameSettingsSchema } from '@hangman/shared';
import wordsEng from './words_eng';
import wordsEst from './words_est';
import { filterWords, selectRandomWords } from './words';

export { Room };

export default {
    async fetch(request: Request, env: any) {
        try {
            const url = new URL(request.url);

            // Auth verification (placeholder)
            if (url.pathname === '/api/auth/google' && request.method === 'POST') {
                // TODO: Verify token, set session cookie
                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Set-Cookie': 'session=dummy; HttpOnly; Secure; SameSite=Lax', 'Content-Type': 'application/json' }
                });
            }

            // Create game
            if (url.pathname === '/api/games' && request.method === 'POST') {
                const body = await request.json();
                console.log('Create game request:', body);

                const settings = GameSettingsSchema.parse(body);

                const wordSource = settings.language === 'en' ? wordsEng : wordsEst;
                const filtered = filterWords(wordSource as string[], settings);
                const selectedWords = selectRandomWords(filtered, settings.roundsCount);

                const id = env.ROOMS.newUniqueId();
                const room = env.ROOMS.get(id);

                // Init room
                const initResp = await room.fetch(new Request('http://room/init', {
                    method: 'POST',
                    body: JSON.stringify({ settings, words: selectedWords })
                }));
                if (!initResp.ok) throw new Error("Room init failed: " + await initResp.text());

                return new Response(JSON.stringify({
                    roomId: id.toString(),
                    wsUrl: `ws://${url.host}/ws/rooms/${id.toString()}`
                }), { headers: { 'Content-Type': 'application/json' } });
            }

            // WebSocket routing
            if (url.pathname.startsWith('/ws/rooms/')) {
                const roomIdStr = url.pathname.split('/').pop()!;
                const id = env.ROOMS.idFromString(roomIdStr);
                const room = env.ROOMS.get(id);
                return room.fetch(request);
            }

            return new Response('Not Found', { status: 404 });
        } catch (e: any) {
            console.error(e);
            return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }
};
