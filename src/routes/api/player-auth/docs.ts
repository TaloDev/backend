import { RouteDocs } from '../../../lib/docs/docs-registry'

const sampleAlias = {
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
    createdAt: '2024-06-28T12:37:43.514Z',
    lastSeenAt: '2024-06-28T12:37:43.514Z',
    groups: [],
    auth: {
      email: 'boz@mail.com',
      verificationEnabled: true,
      sessionCreatedAt: '2024-06-28T12:37:43.514Z'
    }
  }
}

const sampleSessionToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJZCI6IjdhNGU3MGVjLTZlZTYtNDE4ZS05MjNkLWIzYTQ1MDUxYjdmOSIsImFsaWFzSWQiOjEsImlhdCI6MTcxOTU5Mjk3Nn0.gb4-IA_fsDcXOnS3PkQp1eBqwYBaYWiHEmjlqXfd078'

export const registerDocs = {
  description: 'Create a new player account',
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
        alias: sampleAlias,
        sessionToken: sampleSessionToken
      }
    }
  ]
} satisfies RouteDocs

export const loginDocs = {
  description: 'Login to a player account',
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
        alias: sampleAlias,
        sessionToken: sampleSessionToken
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
} satisfies RouteDocs

export const verifyDocs = {
  description: 'Provide the verification code to start the player session',
  samples: [
    {
      title: 'Sample request',
      sample: {
        aliasId: 1,
        code: '023251'
      }
    },
    {
      title: 'Sample response',
      sample: {
        alias: sampleAlias,
        sessionToken: sampleSessionToken
      }
    }
  ]
} satisfies RouteDocs

export const logoutDocs = {
  description: 'Logout of a player account (and invalidate the session token)'
} satisfies RouteDocs

export const changePasswordDocs = {
  description: 'Change the password of a player account',
  samples: [
    {
      title: 'Sample request',
      sample: {
        currentPassword: 'password',
        newPassword: 'new_password'
      }
    }
  ]
} satisfies RouteDocs

export const changeEmailDocs = {
  description: 'Change the email address of a player account',
  samples: [
    {
      title: 'Sample request',
      sample: {
        currentPassword: 'password',
        newEmail: 'boz2@mail.com'
      }
    }
  ]
} satisfies RouteDocs

export const forgotPasswordDocs = {
  description: 'Send a password reset email to an email address',
  samples: [
    {
      title: 'Sample request',
      sample: {
        email: 'boz@mail.com'
      }
    }
  ]
} satisfies RouteDocs

export const resetPasswordDocs = {
  description: 'Reset the password of a player account (invalidates any existing session tokens)',
  samples: [
    {
      title: 'Sample request',
      sample: {
        code: '642230',
        password: 'new_password'
      }
    }
  ]
} satisfies RouteDocs

export const toggleVerificationDocs = {
  description: 'Toggle verification for a player account',
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
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a player account',
  samples: [
    {
      title: 'Sample request',
      sample: {
        currentPassword: 'password'
      }
    }
  ]
} satisfies RouteDocs
