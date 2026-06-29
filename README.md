## Configuration
Create a `.env` file in the **root directory** of the project (at the same level as the `src` folder)

```toml
DISCORD_TOKEN=your_discord_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
APPLICATION_ID=your_discord_application_id_here
QWEN_API_KEY=your_qwen_api_key_here
MONGODB_URI=your_mongodb_connection_string_here
```

**Security Warning**: Never commit your .env file to version control. Keep your tokens and API keys secret to prevent your bot from being hijacked.

## License
This project is licensed under the AGPL-3.0 License - see the LICENSE file for details.