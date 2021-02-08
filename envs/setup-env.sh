#!/bin/sh
export $(grep -v '^#' .env | xargs)
