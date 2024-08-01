import PlayerAuthAPIService from '../services/api/player-auth-api.service'
import APIDocs from './api-docs'

const PlayerAuthAPIDocs: APIDocs<PlayerAuthAPIService> = {
  register: {
    description: 'Create a new player account',
    params: {
      body: {
        identifier: 'The unique identifier of the player. This can be their username, an email or a numeric ID',
        password: 'The password the player will login with',
        verificationEnabled: 'When enabled, the player will be sent a verification code to their email address before they can login',
        email: 'Required when verification is enabled. This is also used for password resets: players without an email cannot reset their password'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          identifier: 'boz',
          password: 'password',
          verificationEnabled: true,
          email: 'boz@mail.com'
        }
      },
      {
        title: 'Sample response',
        sample: {
          alias: {
            id: 1,
            service: 'talo',
            identifier: 'boz',
            player: {
              id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
              props: [],
              aliases: [
                '/* [Circular] */'
              ],
              devBuild: false,
              createdAt: '2024-06-28 12:37:43',
              lastSeenAt: '2024-06-28 12:37:43',
              groups: [],
              auth: {
                email: 'boz@mail.com',
                verificationEnabled: true,
                sessionCreatedAt: '2024-06-28 12:37:43'
              }
            }
          },
          sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJZCI6IjdhNGU3MGVjLTZlZTYtNDE4ZS05MjNkLWIzYTQ1MDUxYjdmOSIsImFsaWFzSWQiOjEsImlhdCI6MTcxOTU5Mjk3Nn0.gb4-IA_fsDcXOnS3PkQp1eBqwYBaYWiHEmjlqXfd078'
        }
      }
    ]
  },
  login: {
    description: 'Login to a player account',
    params: {
      body: {
        identifier: 'The unique identifier of the player. This can be their username, an email or a numeric ID',
        password: 'The player\'s password'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          identifier: 'boz',
          password: 'password'
        }
      },
      {
        title: 'Sample response (verification not enabled)',
        sample: {
          alias: {
            id: 1,
            service: 'talo',
            identifier: 'boz',
            player: {
              id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
              props: [],
              aliases: [
                '/* [Circular] */'
              ],
              devBuild: false,
              createdAt: '2024-06-28 12:37:43',
              lastSeenAt: '2024-06-28 12:37:43',
              groups: [],
              auth: {
                email: 'boz@mail.com',
                verificationEnabled: true,
                sessionCreatedAt: '2024-06-28 12:37:43'
              }
            }
          },
          sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJZCI6IjdhNGU3MGVjLTZlZTYtNDE4ZS05MjNkLWIzYTQ1MDUxYjdmOSIsImFsaWFzSWQiOjEsImlhdCI6MTcxOTU5Mjk3Nn0.gb4-IA_fsDcXOnS3PkQp1eBqwYBaYWiHEmjlqXfd078'
        }
      },
      {
        title: 'Sample response (verification enabled)',
        sample: {
          aliasId: 1,
          verificationRequired: true
        }
      }
    ]
  },
  verify: {
    description: 'Provide the verification code to start the player session',
    params: {
      body: {
        aliasId: 'The ID of the alias to verify',
        code: 'The 6-digit verification code sent to the player (must be a string)'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          aliasId: 1,
          password: '023251'
        }
      },
      {
        title: 'Sample response',
        sample: {
          alias: {
            id: 1,
            service: 'talo',
            identifier: 'boz',
            player: {
              id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
              props: [],
              aliases: [
                '/* [Circular] */'
              ],
              devBuild: false,
              createdAt: '2024-06-28 12:37:43',
              lastSeenAt: '2024-06-28 12:37:43',
              groups: [],
              auth: {
                email: 'boz@mail.com',
                verificationEnabled: true,
                sessionCreatedAt: '2024-06-28 12:37:43'
              }
            }
          },
          sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJZCI6IjdhNGU3MGVjLTZlZTYtNDE4ZS05MjNkLWIzYTQ1MDUxYjdmOSIsImFsaWFzSWQiOjEsImlhdCI6MTcxOTU5Mjk3Nn0.gb4-IA_fsDcXOnS3PkQp1eBqwYBaYWiHEmjlqXfd078'
        }
      }
    ]
  },
  logout: {
    description: 'Logout of a player account (and invalidate the session token)',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player',
        'x-talo-alias': 'The ID of the player\'s alias',
        'x-talo-session': 'The session token'
      }
    }
  },
  changePassword: {
    description: 'Change the password of a player account',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player',
        'x-talo-alias': 'The ID of the player\'s alias',
        'x-talo-session': 'The session token'
      },
      body: {
        currentPassword: 'The current password of the player',
        newPassword: 'The new password for the player'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          currentPassword: 'password',
          newPassword: 'new_password'
        }
      }
    ]
  },
  changeEmail: {
    description: 'Change the email address of a player account',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player',
        'x-talo-alias': 'The ID of the player\'s alias',
        'x-talo-session': 'The session token'
      },
      body: {
        currentPassword: 'The current password of the player',
        newEmail: 'The new email address for the player'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          currentPassword: 'password',
          newEmail: 'boz2@mail.com'
        }
      }
    ]
  },
  forgotPassword: {
    description: 'Send a password reset email to an email address',
    params: {
      body: {
        email: 'The email address to send the verification code to. If no player with this email exists, the request will be ignored'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          email: 'boz@mail.com'
        }
      }
    ]
  },
  resetPassword: {
    description: 'Reset the password of a player account (invalidates any existing session tokens)',
    params: {
      body: {
        code: 'The 6-digit verification code sent to the email address (must be a string)',
        password: 'The new password for the player'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          code: '642230',
          password: 'new_password'
        }
      }
    ]
  },
  toggleVerification: {
    description: 'Toggle if verification is required for a player account',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player',
        'x-talo-alias': 'The ID of the player\'s alias',
        'x-talo-session': 'The session token'
      },
      body: {
        currentPassword: 'The current password of the player',
        verificationEnabled: 'The new verification status for the player account',
        email: 'Required when attempting to enable verification if the player does not currently have an email address set'
      }
    },
    samples: [
      {
        title: 'Sample request (disabling verification)',
        sample: {
          currentPassword: 'password',
          verificationEnabled: false
        }
      },
      {
        title: 'Sample request (enabling verification, player does not have an email address)',
        sample: {
          currentPassword: 'password',
          email: 'boz@mail.com',
          verificationEnabled: true
        }
      },
      {
        title: 'Sample request (enabling verification, player has an email address)',
        sample: {
          currentPassword: 'password',
          verificationEnabled: true
        }
      }
    ]
  }
}

export default PlayerAuthAPIDocs
